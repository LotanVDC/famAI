/////////////////////////////////////////////////////////////////////
// BIM-LLM Blueprint: Quality Assurance Gateway
// Copyright (c) 2024 BIM-LLM Platform
//
// This module provides automated validation and quality assurance
// for generated Revit families, ensuring compliance and performance
/////////////////////////////////////////////////////////////////////

class QAGateway {
    constructor() {
        this.validationRules = this.initializeValidationRules();
        this.performanceMetrics = this.initializePerformanceMetrics();
        this.complianceStandards = this.initializeComplianceStandards();
    }

    /**
     * Comprehensive QA validation of generated family
     * @param {Object} sir - Structured Intermediate Representation
     * @param {string} generatedCode - Generated Python code
     * @param {Object} executionResult - Result from APS execution
     * @returns {Object} QA validation results
     */
    async validateFamily(sir, generatedCode, executionResult) {
        try {
            const validationResults = {
                overallPass: true,
                timestamp: new Date().toISOString(),
                familyName: sir.familyMetadata.familyName,
                category: sir.familyMetadata.category,
                lodLevel: sir.familyMetadata.lodLevel,
                validations: {}
            };

            // Run all validation checks
            validationResults.validations.geometryValidation = await this.validateGeometry(sir);
            validationResults.validations.parameterValidation = await this.validateParameters(sir);
            validationResults.validations.performanceValidation = await this.validatePerformance(sir, generatedCode);
            validationResults.validations.complianceValidation = await this.validateCompliance(sir);
            validationResults.validations.flexingValidation = await this.validateFlexing(sir);
            validationResults.validations.metadataValidation = await this.validateMetadata(sir);

            // Determine overall pass/fail
            validationResults.overallPass = this.determineOverallPass(validationResults.validations);

            // Generate improvement recommendations
            validationResults.recommendations = this.generateRecommendations(validationResults.validations);

            return validationResults;

        } catch (error) {
            console.error('QA Validation Error:', error);
            return {
                overallPass: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate geometry definition and constraints
     */
    async validateGeometry(sir) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // Check for required geometry elements
            if (!sir.geometryDefinition.extrusions || sir.geometryDefinition.extrusions.length === 0) {
                results.issues.push('No extrusions defined in geometry');
                results.pass = false;
                results.score -= 30;
            }

            // Validate extrusion definitions
            if (sir.geometryDefinition.extrusions) {
                sir.geometryDefinition.extrusions.forEach((extrusion, index) => {
                    // Check for valid profile
                    if (!extrusion.profile || extrusion.profile.length < 3) {
                        results.issues.push(`Extrusion ${extrusion.name} has invalid profile (minimum 3 points required)`);
                        results.pass = false;
                        results.score -= 20;
                    }

                    // Check for reasonable dimensions
                    const height = Math.abs(extrusion.endPoint.z - extrusion.startPoint.z);
                    if (height <= 0) {
                        results.issues.push(`Extrusion ${extrusion.name} has zero or negative height`);
                        results.pass = false;
                        results.score -= 15;
                    }

                    // Check for excessive complexity
                    if (extrusion.profile && extrusion.profile.length > 20) {
                        results.warnings.push(`Extrusion ${extrusion.name} has high complexity (${extrusion.profile.length} points)`);
                        results.score -= 5;
                    }
                });
            }

            // Validate reference planes
            if (sir.geometryDefinition.referencePlanes) {
                sir.geometryDefinition.referencePlanes.forEach((plane, index) => {
                    // Check for valid normal vector
                    const normal = plane.normal;
                    const magnitude = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
                    if (Math.abs(magnitude - 1.0) > 0.001) {
                        results.issues.push(`Reference plane ${plane.name} has invalid normal vector`);
                        results.pass = false;
                        results.score -= 10;
                    }
                });
            }

            // Validate constraints
            if (sir.geometryDefinition.constraints) {
                sir.geometryDefinition.constraints.forEach((constraint, index) => {
                    if (!constraint.element1 || !constraint.element2) {
                        results.issues.push(`Constraint ${index} has missing elements`);
                        results.pass = false;
                        results.score -= 10;
                    }
                });
            }

            // LOD-specific geometry validation
            const lod = sir.familyMetadata.lodLevel;
            if (lod <= 200) {
                // Low LOD should have simple geometry
                if (sir.geometryDefinition.extrusions && sir.geometryDefinition.extrusions.length > 3) {
                    results.warnings.push('LOD 200 family has complex geometry - consider simplification');
                    results.score -= 5;
                }
            } else if (lod >= 400) {
                // High LOD should have detailed geometry
                if (!sir.geometryDefinition.extrusions || sir.geometryDefinition.extrusions.length < 2) {
                    results.warnings.push('LOD 400+ family may need more detailed geometry');
                    results.score -= 5;
                }
            }

        } catch (error) {
            results.issues.push(`Geometry validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Validate parameter definitions and relationships
     */
    async validateParameters(sir) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // Check for required parameters
            if (!sir.parameters.familyParameters || sir.parameters.familyParameters.length === 0) {
                results.issues.push('No family parameters defined');
                results.pass = false;
                results.score -= 40;
            }

            // Validate parameter definitions
            if (sir.parameters.familyParameters) {
                const parameterNames = new Set();
                
                sir.parameters.familyParameters.forEach((param, index) => {
                    // Check for duplicate parameter names
                    if (parameterNames.has(param.name)) {
                        results.issues.push(`Duplicate parameter name: ${param.name}`);
                        results.pass = false;
                        results.score -= 15;
                    }
                    parameterNames.add(param.name);

                    // Validate parameter name format
                    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(param.name)) {
                        results.issues.push(`Invalid parameter name format: ${param.name}`);
                        results.pass = false;
                        results.score -= 10;
                    }

                    // Check for required parameter types
                    const validTypes = ['Length', 'Number', 'Text', 'Material', 'YesNo', 'Integer'];
                    if (!validTypes.includes(param.type)) {
                        results.issues.push(`Invalid parameter type: ${param.type}`);
                        results.pass = false;
                        results.score -= 10;
                    }

                    // Validate formulas
                    if (param.formula) {
                        const formulaValidation = this.validateFormula(param.formula, sir.parameters.familyParameters);
                        if (!formulaValidation.valid) {
                            results.issues.push(`Invalid formula for ${param.name}: ${formulaValidation.error}`);
                            results.pass = false;
                            results.score -= 10;
                        }
                    }
                });

                // Check for essential parameters based on family category
                const essentialParams = this.getEssentialParameters(sir.familyMetadata.category);
                essentialParams.forEach(essentialParam => {
                    if (!parameterNames.has(essentialParam)) {
                        results.warnings.push(`Missing essential parameter: ${essentialParam}`);
                        results.score -= 5;
                    }
                });
            }

            // Validate family types
            if (sir.parameters.familyTypes) {
                sir.parameters.familyTypes.forEach((type, index) => {
                    if (!type.name || type.name.trim() === '') {
                        results.issues.push(`Family type ${index} has empty name`);
                        results.pass = false;
                        results.score -= 10;
                    }

                    // Validate parameter values
                    if (type.parameters) {
                        Object.keys(type.parameters).forEach(paramName => {
                            const value = type.parameters[paramName];
                            const paramDef = sir.parameters.familyParameters.find(p => p.name === paramName);
                            
                            if (paramDef) {
                                const valueValidation = this.validateParameterValue(value, paramDef.type);
                                if (!valueValidation.valid) {
                                    results.issues.push(`Invalid value for ${paramName} in type ${type.name}: ${valueValidation.error}`);
                                    results.pass = false;
                                    results.score -= 5;
                                }
                            }
                        });
                    }
                });
            }

        } catch (error) {
            results.issues.push(`Parameter validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Validate performance characteristics
     */
    async validatePerformance(sir, generatedCode) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // Check code complexity
            const codeMetrics = this.analyzeCodeComplexity(generatedCode);
            
            if (codeMetrics.complexityScore > 50) {
                results.warnings.push('High code complexity detected - may impact performance');
                results.score -= 10;
            }

            // Check for performance anti-patterns
            if (generatedCode.includes('while ') || generatedCode.includes('for i in range(1000)')) {
                results.issues.push('Performance anti-pattern detected: excessive loops');
                results.pass = false;
                results.score -= 20;
            }

            // Check geometry complexity
            if (sir.geometryDefinition.extrusions) {
                const totalProfilePoints = sir.geometryDefinition.extrusions.reduce((sum, ext) => {
                    return sum + (ext.profile ? ext.profile.length : 0);
                }, 0);

                if (totalProfilePoints > 100) {
                    results.warnings.push('High geometry complexity - consider optimization');
                    results.score -= 15;
                }
            }

            // Check for excessive parameters
            if (sir.parameters.familyParameters && sir.parameters.familyParameters.length > 20) {
                results.warnings.push('High parameter count - may impact family performance');
                results.score -= 10;
            }

            // LOD-specific performance checks
            const lod = sir.familyMetadata.lodLevel;
            if (lod <= 200) {
                // Low LOD should be optimized for speed
                if (sir.geometryDefinition.extrusions && sir.geometryDefinition.extrusions.length > 2) {
                    results.warnings.push('LOD 200 family should have minimal geometry for performance');
                    results.score -= 10;
                }
            }

        } catch (error) {
            results.issues.push(`Performance validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Validate compliance with industry standards
     */
    async validateCompliance(sir) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // BIM Execution Plan compliance
            const bepCompliance = this.validateBEPCompliance(sir);
            if (!bepCompliance.pass) {
                results.issues.push(...bepCompliance.issues);
                results.pass = false;
                results.score -= bepCompliance.scoreDeduction;
            }

            // Industry standard compliance
            const industryCompliance = this.validateIndustryStandards(sir);
            if (!industryCompliance.pass) {
                results.issues.push(...industryCompliance.issues);
                results.pass = false;
                results.score -= industryCompliance.scoreDeduction;
            }

            // Category-specific compliance
            const categoryCompliance = this.validateCategoryCompliance(sir);
            if (!categoryCompliance.pass) {
                results.issues.push(...categoryCompliance.issues);
                results.pass = false;
                results.score -= categoryCompliance.scoreDeduction;
            }

        } catch (error) {
            results.issues.push(`Compliance validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Validate parameter flexing capabilities
     */
    async validateFlexing(sir) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // Check for flexing test scenarios
            const flexingScenarios = this.generateFlexingScenarios(sir);
            
            flexingScenarios.forEach(scenario => {
                const scenarioValidation = this.validateFlexingScenario(scenario, sir);
                if (!scenarioValidation.pass) {
                    results.issues.push(`Flexing scenario failed: ${scenarioValidation.error}`);
                    results.pass = false;
                    results.score -= 15;
                }
            });

            // Check for constraint dependencies
            if (sir.geometryDefinition.constraints) {
                const constraintValidation = this.validateConstraintDependencies(sir.geometryDefinition.constraints);
                if (!constraintValidation.pass) {
                    results.issues.push(...constraintValidation.issues);
                    results.pass = false;
                    results.score -= constraintValidation.scoreDeduction;
                }
            }

        } catch (error) {
            results.issues.push(`Flexing validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Validate metadata completeness and accuracy
     */
    async validateMetadata(sir) {
        const results = {
            pass: true,
            issues: [],
            warnings: [],
            score: 100
        };

        try {
            // Check required metadata fields
            const requiredFields = ['familyName', 'category', 'lodLevel'];
            requiredFields.forEach(field => {
                if (!sir.familyMetadata[field]) {
                    results.issues.push(`Missing required metadata field: ${field}`);
                    results.pass = false;
                    results.score -= 20;
                }
            });

            // Validate LOD level
            const lod = sir.familyMetadata.lodLevel;
            if (lod < 100 || lod > 500 || lod % 100 !== 0) {
                results.issues.push(`Invalid LOD level: ${lod} (must be 100, 200, 300, 400, or 500)`);
                results.pass = false;
                results.score -= 25;
            }

            // Validate category
            const validCategories = [
                'Doors', 'Windows', 'Furniture', 'Structural Framing', 'Structural Columns',
                'Mechanical Equipment', 'Electrical Equipment', 'Plumbing Fixtures'
            ];
            if (!validCategories.includes(sir.familyMetadata.category)) {
                results.warnings.push(`Non-standard category: ${sir.familyMetadata.category}`);
                results.score -= 5;
            }

            // Check for description
            if (!sir.familyMetadata.description || sir.familyMetadata.description.trim() === '') {
                results.warnings.push('Missing family description');
                results.score -= 5;
            }

        } catch (error) {
            results.issues.push(`Metadata validation error: ${error.message}`);
            results.pass = false;
            results.score = 0;
        }

        return results;
    }

    /**
     * Generate flexing test scenarios
     */
    generateFlexingScenarios(sir) {
        const scenarios = [];
        
        if (sir.parameters.familyParameters) {
            // Generate scenarios for dimensional parameters
            sir.parameters.familyParameters.forEach(param => {
                if (param.type === 'Length' || param.type === 'Number') {
                    scenarios.push({
                        parameter: param.name,
                        testValues: this.generateTestValues(param),
                        description: `Test flexing for parameter ${param.name}`
                    });
                }
            });
        }

        return scenarios;
    }

    /**
     * Generate test values for parameter flexing
     */
    generateTestValues(param) {
        const testValues = [];
        
        // Add default value
        if (param.defaultValue !== undefined) {
            testValues.push(param.defaultValue);
        }

        // Add extreme values
        if (param.type === 'Length') {
            testValues.push(0.1, 1, 10, 100); // Various scales
        } else if (param.type === 'Number') {
            testValues.push(0, 1, 10, 100, 1000);
        }

        return testValues;
    }

    /**
     * Validate flexing scenario
     */
    validateFlexingScenario(scenario, sir) {
        // This would typically involve running the generated code
        // with different parameter values and checking for errors
        // For now, we'll do static analysis
        
        const result = {
            pass: true,
            error: null
        };

        // Check if parameter exists in formulas
        if (scenario.parameter) {
            const hasFormulaReference = sir.parameters.familyParameters.some(param => {
                return param.formula && param.formula.includes(scenario.parameter);
            });

            if (hasFormulaReference) {
                // Validate formula syntax
                const formulaValidation = this.validateFormula(
                    sir.parameters.familyParameters.find(p => p.formula && p.formula.includes(scenario.parameter)).formula,
                    sir.parameters.familyParameters
                );

                if (!formulaValidation.valid) {
                    result.pass = false;
                    result.error = `Formula validation failed: ${formulaValidation.error}`;
                }
            }
        }

        return result;
    }

    /**
     * Validate formula syntax and dependencies
     */
    validateFormula(formula, parameters) {
        const result = {
            valid: true,
            error: null
        };

        try {
            // Basic syntax validation
            if (!formula || formula.trim() === '') {
                result.valid = false;
                result.error = 'Empty formula';
                return result;
            }

            // Check for valid operators
            const validOperators = ['+', '-', '*', '/', '(', ')', '=', '<', '>', '<=', '>='];
            const formulaChars = formula.split('');
            const hasValidOperators = formulaChars.some(char => validOperators.includes(char));
            
            if (!hasValidOperators && formula.length > 1) {
                result.valid = false;
                result.error = 'Formula contains no valid operators';
                return result;
            }

            // Check for parameter references
            const parameterNames = parameters.map(p => p.name);
            const formulaWords = formula.split(/[\s+\-*/()=<>]+/);
            
            formulaWords.forEach(word => {
                if (word && isNaN(word) && !parameterNames.includes(word)) {
                    result.valid = false;
                    result.error = `Undefined parameter reference: ${word}`;
                    return;
                }
            });

        } catch (error) {
            result.valid = false;
            result.error = `Formula validation error: ${error.message}`;
        }

        return result;
    }

    /**
     * Get essential parameters for family category
     */
    getEssentialParameters(category) {
        const essentialParams = {
            'Doors': ['Width', 'Height', 'Thickness'],
            'Windows': ['Width', 'Height', 'Sill Height'],
            'Furniture': ['Width', 'Depth', 'Height'],
            'Structural Framing': ['Length', 'Width', 'Height'],
            'Structural Columns': ['Width', 'Depth', 'Height'],
            'Mechanical Equipment': ['Width', 'Depth', 'Height'],
            'Electrical Equipment': ['Width', 'Depth', 'Height'],
            'Plumbing Fixtures': ['Width', 'Depth', 'Height']
        };

        return essentialParams[category] || [];
    }

    /**
     * Validate parameter value against type
     */
    validateParameterValue(value, type) {
        const result = {
            valid: true,
            error: null
        };

        try {
            switch (type) {
                case 'Length':
                case 'Number':
                    if (isNaN(value)) {
                        result.valid = false;
                        result.error = 'Value must be numeric';
                    }
                    break;
                case 'Integer':
                    if (!Number.isInteger(Number(value))) {
                        result.valid = false;
                        result.error = 'Value must be an integer';
                    }
                    break;
                case 'YesNo':
                    if (value !== true && value !== false && value !== 'true' && value !== 'false') {
                        result.valid = false;
                        result.error = 'Value must be true or false';
                    }
                    break;
                case 'Text':
                case 'Material':
                    if (typeof value !== 'string') {
                        result.valid = false;
                        result.error = 'Value must be a string';
                    }
                    break;
            }
        } catch (error) {
            result.valid = false;
            result.error = `Value validation error: ${error.message}`;
        }

        return result;
    }

    /**
     * Analyze code complexity
     */
    analyzeCodeComplexity(code) {
        const metrics = {
            linesOfCode: code.split('\n').length,
            complexityScore: 0,
            cyclomaticComplexity: 0
        };

        // Simple complexity analysis
        const complexityIndicators = [
            'if ', 'for ', 'while ', 'try:', 'except:', 'def ', 'class '
        ];

        complexityIndicators.forEach(indicator => {
            const matches = (code.match(new RegExp(indicator, 'g')) || []).length;
            metrics.complexityScore += matches * 2;
        });

        return metrics;
    }

    /**
     * Determine overall pass/fail status
     */
    determineOverallPass(validations) {
        const criticalValidations = ['geometryValidation', 'parameterValidation', 'metadataValidation'];
        
        for (const validation of criticalValidations) {
            if (!validations[validation] || !validations[validation].pass) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate improvement recommendations
     */
    generateRecommendations(validations) {
        const recommendations = [];

        Object.keys(validations).forEach(validationType => {
            const validation = validations[validationType];
            if (validation && validation.issues && validation.issues.length > 0) {
                recommendations.push({
                    type: validationType,
                    priority: 'high',
                    issues: validation.issues,
                    suggestions: this.getSuggestionsForIssues(validationType, validation.issues)
                });
            }

            if (validation && validation.warnings && validation.warnings.length > 0) {
                recommendations.push({
                    type: validationType,
                    priority: 'medium',
                    warnings: validation.warnings,
                    suggestions: this.getSuggestionsForWarnings(validationType, validation.warnings)
                });
            }
        });

        return recommendations;
    }

    /**
     * Get suggestions for specific issues
     */
    getSuggestionsForIssues(validationType, issues) {
        const suggestions = [];

        issues.forEach(issue => {
            switch (validationType) {
                case 'geometryValidation':
                    if (issue.includes('invalid profile')) {
                        suggestions.push('Ensure extrusion profiles have at least 3 points forming a closed loop');
                    }
                    break;
                case 'parameterValidation':
                    if (issue.includes('Invalid parameter name')) {
                        suggestions.push('Use alphanumeric names starting with a letter, avoid special characters');
                    }
                    break;
                case 'metadataValidation':
                    if (issue.includes('Invalid LOD level')) {
                        suggestions.push('Use standard LOD levels: 100, 200, 300, 400, or 500');
                    }
                    break;
            }
        });

        return suggestions;
    }

    /**
     * Get suggestions for warnings
     */
    getSuggestionsForWarnings(validationType, warnings) {
        const suggestions = [];

        warnings.forEach(warning => {
            switch (validationType) {
                case 'performanceValidation':
                    if (warning.includes('High complexity')) {
                        suggestions.push('Consider simplifying geometry or reducing parameter count for better performance');
                    }
                    break;
                case 'geometryValidation':
                    if (warning.includes('complex geometry')) {
                        suggestions.push('For LOD 200 families, use simple symbolic geometry instead of detailed 3D models');
                    }
                    break;
            }
        });

        return suggestions;
    }

    /**
     * Initialize validation rules
     */
    initializeValidationRules() {
        return {
            geometry: {
                minProfilePoints: 3,
                maxProfilePoints: 50,
                maxExtrusions: 10
            },
            parameters: {
                maxParameters: 30,
                requiredNamingPattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                validTypes: ['Length', 'Number', 'Text', 'Material', 'YesNo', 'Integer']
            },
            performance: {
                maxCodeComplexity: 50,
                maxExecutionTime: 300, // 5 minutes
                maxFileSize: 1024 * 1024 // 1MB
            }
        };
    }

    /**
     * Initialize performance metrics
     */
    initializePerformanceMetrics() {
        return {
            executionTime: 0,
            memoryUsage: 0,
            fileSize: 0,
            complexityScore: 0
        };
    }

    /**
     * Initialize compliance standards
     */
    initializeComplianceStandards() {
        return {
            bimForum: {
                lod100: 'Conceptual',
                lod200: 'Design Development',
                lod300: 'Construction Documentation',
                lod400: 'Construction',
                lod500: 'As-Built'
            },
            aia: {
                lod100: 'Conceptual Massing',
                lod200: 'Design Development',
                lod300: 'Construction Documentation',
                lod400: 'Construction',
                lod500: 'As-Built'
            }
        };
    }

    // Additional validation methods would be implemented here
    validateBEPCompliance(sir) {
        // BIM Execution Plan compliance validation
        return { pass: true, issues: [], scoreDeduction: 0 };
    }

    validateIndustryStandards(sir) {
        // Industry standard compliance validation
        return { pass: true, issues: [], scoreDeduction: 0 };
    }

    validateCategoryCompliance(sir) {
        // Category-specific compliance validation
        return { pass: true, issues: [], scoreDeduction: 0 };
    }

    validateConstraintDependencies(constraints) {
        // Constraint dependency validation
        return { pass: true, issues: [], scoreDeduction: 0 };
    }
}

module.exports = QAGateway;

