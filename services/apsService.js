const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { designAutomation } = require('../config');

// Create authentication client
const authenticationClient = new AuthenticationClient();

// Create custom authentication provider for OSS client
const authenticationProvider = {
    async getAccessToken(scopes) {
        const credentials = await authenticationClient.getTwoLeggedToken(
            process.env.APS_CLIENT_ID, 
            process.env.APS_CLIENT_SECRET, 
            scopes || [
                Scopes.DataRead,
                Scopes.DataCreate,
                Scopes.DataWrite,
                Scopes.BucketCreate,
                Scopes.BucketRead
            ]
        );
        return credentials.access_token;
    }
};

// Create OSS client with custom authentication provider
const ossClient = new OssClient({
    authenticationProvider: authenticationProvider
});

// Create Model Derivative client with custom authentication provider
const modelDerivativeClient = new ModelDerivativeClient({
    authenticationProvider: authenticationProvider
});

const service = module.exports = {};

/**
 * Get internal token for server operations
 */
async function getInternalToken() {
    const credentials = await authenticationClient.getTwoLeggedToken(
        process.env.APS_CLIENT_ID, 
        process.env.APS_CLIENT_SECRET, 
        [
            Scopes.DataRead,
            Scopes.DataCreate,
            Scopes.DataWrite,
            Scopes.BucketCreate,
            Scopes.BucketRead,
            Scopes.ViewablesRead
        ]
    );
    return credentials.access_token;
}

/**
 * Get viewer token for client-side operations
 */
service.getViewerToken = async () => {
    return await authenticationClient.getTwoLeggedToken(
        process.env.APS_CLIENT_ID, 
        process.env.APS_CLIENT_SECRET, 
        [Scopes.ViewablesRead]
    );
};

/**
 * Ensure bucket exists for storing files
 */
service.ensureBucketExists = async (bucketKey) => {
    try {
        await ossClient.getBucketDetails(bucketKey);
    } catch (err) {
        if (err.axiosError?.response?.status === 404) {
            await ossClient.createBucket(
                Region.Us, 
                { bucketKey: bucketKey, policyKey: PolicyKey.Transient }
            );
            console.log('Created bucket:', bucketKey);
        } else {
            throw err;
        }
    }
};

/**
 * Create a temporary bucket for RFA file storage
 */
service.createTemporaryBucket = async () => {
    const bucketKey = `temp-rfa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await service.ensureBucketExists(bucketKey);
    return bucketKey;
};

/**
 * Create signed URL for file operations
 */
service.createSignedUrl = async (bucketKey, objectKey, verb = 'put') => {
    const signedResource = await ossClient.createSignedResource(bucketKey, objectKey, {
        access: 'readwrite'
    });
    return signedResource.signedUrl;
};

/**
 * Upload object to OSS
 */
service.uploadObject = async (bucketKey, objectKey, filePath) => {
    const obj = await ossClient.uploadObject(bucketKey, objectKey, filePath);
    return obj;
};

/**
 * Get object details
 */
service.getObjectDetails = async (bucketKey, objectKey) => {
    const obj = await ossClient.getObjectDetails(bucketKey, objectKey);
    return obj;
};

/**
 * Convert base64 to URN
 */
service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');

/**
 * Start translation job for viewer
 */
service.translateObject = async (urn, rootFilename) => {
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
        output: {
            formats: [{
                views: [View._2d, View._3d],
                type: OutputType.Svf2
            }]
        }
    });
    return job.result;
};

/**
 * Get manifest for translation status
 */
service.getManifest = async (urn) => {
    try {
        const manifest = await modelDerivativeClient.getManifest(urn);
        return manifest;
    } catch (err) {
        if (err.axiosError?.response?.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};
