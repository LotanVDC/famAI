/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Autodesk Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

const request = require("request");

const { designAutomation }= require('../../config');

const {
    ObjectsApi,
    ProjectsApi, 
    StorageRelationshipsTarget,
    CreateStorageDataRelationships,
    CreateStorageDataAttributes,
    CreateStorageData,
    CreateStorage,
    StorageRelationshipsTargetData
} = require('forge-apis');


const AUTODESK_HUB_BUCKET_KEY = 'wip.dm.prod';
var workitemList = [];

/**
 * Create a temporary storage bucket for local file operations
 */
async function createTemporaryStorage() {
    const apsService = require('../../services/apsService');
    return await apsService.createTemporaryBucket();
}

/**
 * Create a signed URL for file upload/download
 */
async function createSignedUrl(bucketKey, objectKey, verb = 'put') {
    const apsService = require('../../services/apsService');
    return await apsService.createSignedUrl(bucketKey, objectKey, verb);
}

/**
 * Create window family using APS OSS for local storage (no BIM 360)
 */
async function createWindowFamilyLocal(inputUrl, windowParams, oauth_client, access_token_2Legged) {
    try {
        // Create temporary storage bucket
        const bucketKey = await createTemporaryStorage();
        
        // Create signed URL for output file
        const outputObjectKey = `output/Generated_Window_${Date.now()}.rfa`;
        const outputUrl = await createSignedUrl(bucketKey, outputObjectKey, 'put');
        
        console.log('Created output URL:', outputUrl);
        
        // Log the windowParams being sent for debugging
        console.log('Window parameters being sent to Revit plugin:', JSON.stringify(windowParams, null, 2));
        
        const workitemBody = {
            activityId: designAutomation.nickname + '.' + designAutomation.activity_name+'+'+designAutomation.appbundle_activity_alias,
            arguments: {
                templateFile: {
                    url: inputUrl,
                    Headers: {
                        Authorization: 'Bearer ' + access_token_2Legged.access_token
                    },
                },
                windowParams: {
                    url: "data:application/json," + JSON.stringify(windowParams),
                    localName: "WindowParams.json"  // CRITICAL: Must match filename in C# code (WindowWizard.cs line 65)
                },
                resultFamily: {
                    verb: 'put',
                    url: outputUrl
                },
                adskDebug: {
                    uploadJobFolder: true  // Enable debug logs to see Revit plugin output
                },
                onComplete: {
                    verb: "post",
                    url: designAutomation.webhook_url
                }
            }
        };
        
        console.log('Submitting workitem with local storage:', workitemBody);
        
        // Use fetch instead of request library
        const response = await fetch(designAutomation.endpoint + 'workitems', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + access_token_2Legged.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workitemBody)
        });
        
        const body = await response.text();
        let resp;
        try {
            resp = JSON.parse(body);
        } catch (e) {
            resp = body;
        }
        
        console.log('APS API Response:', JSON.stringify(resp, null, 2));
        console.log('Response status:', response.status);
        
        if (response.ok) {
            // Store bucket info for later download
            resp.bucketKey = bucketKey;
            resp.outputObjectKey = outputObjectKey;
            console.log('Modified response with bucket info:', JSON.stringify(resp, null, 2));
            return {
                statusCode: response.status,
                body: resp
            };
        } else {
            throw new Error(`Workitem creation failed: ${response.status} ${response.statusText} - ${JSON.stringify(resp)}`);
        }
        
    } catch (error) {
        console.error('Error creating window family:', error);
        throw error;
    }
}


async function getWorkitemStatus(workItemId, access_token) {
    try {
        const response = await fetch(designAutomation.endpoint + 'workitems/' + workItemId, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token,
                'Content-Type': 'application/json'
            }
        });
        
        const body = await response.text();
        let resp;
        try {
            resp = JSON.parse(body);
        } catch (e) {
            resp = body;
        }
        
        if (!response.ok) {
            console.log('error code: ' + response.status + ' response message: ' + response.statusText);
            throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
        }
        
        return {
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: resp
        };
        
    } catch (error) {
        console.error('Error getting workitem status:', error);
        throw error;
    }
}


function cancelWrokitem(workItemId, access_token) {

    return new Promise(function (resolve, reject) {

        var options = {
            method: 'DELETE',
            url:  designAutomation.endpoint + 'workitems/' + workItemId,
            headers: {
                Authorization: 'Bearer ' + access_token,
                'Content-Type': 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(err);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    });
}




function createBodyOfPostStorage(folderId, fileName) {
    // create a new storage for the ouput item version
    let createStorage = new CreateStorage();
    let storageRelationshipsTargetData = new StorageRelationshipsTargetData("folders", folderId);
    let storageRelationshipsTarget = new StorageRelationshipsTarget;
    let createStorageDataRelationships = new CreateStorageDataRelationships();
    let createStorageData = new CreateStorageData();
    let createStorageDataAttributes = new CreateStorageDataAttributes();

    createStorageDataAttributes.name = fileName;
    storageRelationshipsTarget.data = storageRelationshipsTargetData;
    createStorageDataRelationships.target = storageRelationshipsTarget;
    createStorageData.relationships = createStorageDataRelationships;
    createStorageData.type = 'objects';
    createStorageData.attributes = createStorageDataAttributes;
    createStorage.data = createStorageData;
    
    return createStorage;
}


function createBodyOfPostItem( fileName, folderId, storageId, itemType, versionType){
    const body = 
    {
        "jsonapi":{
            "version":"1.0"
        },
        "data":{
            "type":"items",
            "attributes":{
                "name":fileName,
                "extension":{
                    "type":itemType,
                    "version":"1.0"
                }
            },
            "relationships":{
                "tip":{
                    "data":{
                        "type":"versions",
                        "id":"1"
                    }
                },
                "parent":{
                    "data":{
                        "type":"folders",
                        "id":folderId
                    }
                }
            }
        },
        "included":[
            {
                "type":"versions",
                "id":"1",
                "attributes":{
                    "name":fileName,
                    "extension":{
                        "type":versionType,
                        "version":"1.0"
                    }
                },
                "relationships":{
                    "storage":{
                        "data":{
                            "type":"objects",
                            "id":storageId
                        }
                    }
                }
            }
        ]
    };
    return body;
}

async function getNewCreatedStorageInfo(projectId, folderId, fileName, oauth_client, oauth_token) {

    // create body for Post Storage request
    let createStorageBody = createBodyOfPostStorage(folderId, fileName);

    const project = new ProjectsApi();
    let storage = await project.postStorage(projectId, createStorageBody, oauth_client, oauth_token);
    if (storage === null || storage.statusCode !== 201) {
        console.log('failed to create a storage.');
        return null;
    }
    return {
        "StorageId": storage.body.data.id
    }
}



function createWindowFamily(inputUrl, windowParams, outputUrl, projectId, createVersionData, access_token_3Legged, access_token_2Legged) {
    return new Promise(function (resolve, reject) {
        const workitemBody = {
            activityId: designAutomation.nickname + '.' + designAutomation.activity_name+'+'+designAutomation.appbundle_activity_alias,
            arguments: {
                templateFile: {
                    url: inputUrl,
                    Headers: {
                        Authorization: 'Bearer ' + access_token_2Legged.access_token
                    },
                },
                windowParams: {
                    url: "data:application/json," + JSON.stringify(windowParams),
                    localName: "WindowParams.json"  // CRITICAL: Must match filename in C# code (WindowWizard.cs line 65)
                },
                resultFamily: {
                    verb: 'put',
                    url: outputUrl,
                    headers:{
                        Authorization: 'Bearer ' + access_token_3Legged.access_token,
                    },
                },
                onComplete: {
                    verb: "post",
                    url: designAutomation.webhook_url
                },
                adskDebug: {
                    uploadJobFolder: true  // Enable debug logs to see Revit plugin output
                }
            }
        };
        var options = {
            method: 'POST',
            url: designAutomation.endpoint + 'workitems',
            headers: {
                Authorization: 'Bearer ' + access_token_2Legged.access_token,
                'Content-Type': 'application/json'
            },
            body: workitemBody,
            json: true
        };

        console.log(options);
        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                workitemList.push({
                    workitemId: resp.id,
                    projectId: projectId,
                    createVersionData: createVersionData,
                    access_token_3Legged: access_token_3Legged
                })

                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    })
}

module.exports = {
    getNewCreatedStorageInfo,
    createBodyOfPostItem,
    createWindowFamily,
    createWindowFamilyLocal,
    createTemporaryStorage,
    createSignedUrl,
    cancelWrokitem,
    getWorkitemStatus,
    workitemList
};