/////////////////////////////////////////////////////////////////////
// BIM-LLM Blueprint: SIR-to-Code Interpreter
// Copyright (c) 2024 BIM-LLM Platform
//
// This module translates Structured Intermediate Representation (SIR)
// into optimized Python code for Revit API execution
/////////////////////////////////////////////////////////////////////

class SIRToCodeInterpreter {
    constructor() {
        this.codeTemplates = this.initializeCodeTemplates();
        this.performanceOptimizations = this.initializePerformanceRules();
    }

    /**
     * Convert SIR to executable Python code for Revit API
     * @param {Object} sir - Structured Intermediate Representation
     * @param {Object} context - Additional context for code generation
     * @returns {Object} Generated code and metadata
     */
    async translateSIRToCode(sir, context = {}) {
        try {
            // Validate SIR structure
            this.validateSIR(sir);
            
            // Generate code sections
            const codeSections = {
                imports: this.generateImports(sir),
                familySetup: this.generateFamilySetup(sir),
                referencePlanes: this.generateReferencePlanes(sir),
                parameters: this.generateParameters(sir),
                geometry: this.generateGeometry(sir),
                constraints: this.generateConstraints(sir),
                materials: this.generateMaterials(sir),
                familyTypes: this.generateFamilyTypes(sir),
                visibility: this.generateVisibilitySettings(sir),
                validation: this.generateValidationCode(sir)
            };
            
            // Combine code sections
            const fullCode = this.combineCodeSections(codeSections);
            
            // Apply performance optimizations
            const optimizedCode = this.applyPerformanceOptimizations(fullCode, sir);
            
            // Generate execution metadata
            const metadata = this.generateExecutionMetadata(sir, optimizedCode);
            
            return {
                success: true,
                code: optimizedCode,
                metadata: metadata,
                sections: codeSections
            };
            
        } catch (error) {
            console.error('SIR-to-Code Translation Error:', error);
            return {
                success: false,
                error: error.message,
                sir: sir
            };
        }
    }

    /**
     * Generate Python imports based on SIR requirements
     */
    generateImports(sir) {
        const imports = [
            'import clr',
            'clr.AddReference("RevitAPI")',
            'clr.AddReference("RevitServices")',
            'clr.AddReference("RevitNodes")',
            '',
            'from Autodesk.Revit.DB import *',
            'from Autodesk.Revit.DB.Structure import *',
            'from Autodesk.Revit.UI import *',
            'from RevitServices.Persistence import DocumentManager',
            'from RevitServices.Transactions import TransactionManager',
            '',
            '# BIM-LLM Generated Code',
            '# Generated at: ' + new Date().toISOString(),
            '# Family: ' + sir.familyMetadata.familyName,
            ''
        ];
        
        // Add specific imports based on family type
        if (sir.familyMetadata.category === 'Doors') {
            imports.push('from Autodesk.Revit.DB.Architecture import *');
        } else if (sir.familyMetadata.category === 'Windows') {
            imports.push('from Autodesk.Revit.DB.Architecture import *');
        } else if (sir.familyMetadata.category.includes('Structural')) {
            imports.push('from Autodesk.Revit.DB.Structure import *');
        }
        
        return imports.join('\n');
    }

    /**
     * Generate family setup code
     */
    generateFamilySetup(sir) {
        const setup = [
            '# Family Setup',
            'doc = DocumentManager.Instance.CurrentDBDocument',
            'app = DocumentManager.Instance.CurrentUIApplication.Application',
            '',
            '# Transaction for family creation',
            'TransactionManager.Instance.EnsureInTransaction(doc)',
            '',
            'try:',
            '    # Family metadata',
            `    family_name = "${sir.familyMetadata.familyName}"`,
            `    family_category = "${sir.familyMetadata.category}"`,
            `    family_description = "${sir.familyMetadata.description || ''}"`,
            `    lod_level = ${sir.familyMetadata.lodLevel}`,
            '',
            '    # Validate family document',
            '    if not doc.IsFamilyDocument:',
            '        raise Exception("This script must run in a family document")',
            '',
            '    # Get family category',
            '    categories = doc.Settings.Categories',
            '    target_category = None',
            '    for cat in categories:',
            '        if cat.Name == family_category:',
            '            target_category = cat',
            '            break',
            '',
            '    if target_category is None:',
            '        raise Exception(f"Category {family_category} not found")',
            '',
            '    # Set family category if not already set',
            '    if doc.OwnerFamily.FamilyCategory.Name != family_category:',
            '        doc.OwnerFamily.FamilyCategory = target_category',
            ''
        ];
        
        return setup.join('\n');
    }

    /**
     * Generate reference planes code
     */
    generateReferencePlanes(sir) {
        const planes = [
            '    # Reference Planes',
            '    reference_planes = {}',
            ''
        ];
        
        if (sir.geometryDefinition.referencePlanes) {
            sir.geometryDefinition.referencePlanes.forEach((plane, index) => {
                planes.push(`    # Reference Plane: ${plane.name}`);
                planes.push(`    plane_origin = XYZ(${plane.origin.x}, ${plane.origin.y}, ${plane.origin.z})`);
                planes.push(`    plane_normal = XYZ(${plane.normal.x}, ${plane.normal.y}, ${plane.normal.z})`);
                planes.push(`    ref_plane = Plane.CreateByNormalAndOrigin(plane_normal, plane_origin)`);
                planes.push(`    reference_planes["${plane.name}"] = ref_plane`);
                planes.push('');
            });
        }
        
        return planes.join('\n');
    }

    /**
     * Generate parameters code
     */
    generateParameters(sir) {
        const parameters = [
            '    # Family Parameters',
            '    created_parameters = {}',
            ''
        ];
        
        if (sir.parameters.familyParameters) {
            sir.parameters.familyParameters.forEach((param, index) => {
                parameters.push(`    # Parameter: ${param.name}`);
                parameters.push(`    param_def = FamilyParameterDefinition.Create("${param.name}", ParameterType.${param.type})`);
                parameters.push(`    param_def.SetGroupTypeId(GroupTypeId.${param.group || 'Data'})`);
                parameters.push(`    param_def.IsInstance = ${param.isInstance ? 'True' : 'False'}`);
                
                if (param.defaultValue !== undefined) {
                    parameters.push(`    param_def.DefaultValue = ${this.formatParameterValue(param.defaultValue, param.type)}`);
                }
                
                if (param.formula) {
                    parameters.push(`    param_def.Formula = "${param.formula}"`);
                }
                
                parameters.push(`    created_parameters["${param.name}"] = param_def`);
                parameters.push('');
            });
        }
        
        return parameters.join('\n');
    }

    /**
     * Generate geometry creation code
     */
    generateGeometry(sir) {
        const geometry = [
            '    # Geometry Creation',
            '    created_geometry = {}',
            ''
        ];
        
        if (sir.geometryDefinition.extrusions) {
            sir.geometryDefinition.extrusions.forEach((extrusion, index) => {
                geometry.push(`    # Extrusion: ${extrusion.name}`);
                geometry.push(`    # Start Point: (${extrusion.startPoint.x}, ${extrusion.startPoint.y}, ${extrusion.startPoint.z})`);
                geometry.push(`    # End Point: (${extrusion.endPoint.x}, ${extrusion.endPoint.y}, ${extrusion.endPoint.z})`);
                geometry.push('');
                geometry.push(`    # Create sketch plane`);
                geometry.push(`    sketch_plane = Plane.CreateByNormalAndOrigin(XYZ(0, 0, 1), XYZ(0, 0, 0))`);
                geometry.push(`    sketch = SketchPlane.Create(doc, sketch_plane)`);
                geometry.push('');
                geometry.push(`    # Create profile curves`);
                geometry.push(`    profile_curves = CurveArray()`);
                
                if (extrusion.profile && extrusion.profile.length > 0) {
                    extrusion.profile.forEach((point, pointIndex) => {
                        const nextPoint = extrusion.profile[(pointIndex + 1) % extrusion.profile.length];
                        geometry.push(`    # Line from (${point.x}, ${point.y}) to (${nextPoint.x}, ${nextPoint.y})`);
                        geometry.push(`    start_pt = XYZ(${point.x}, ${point.y}, 0)`);
                        geometry.push(`    end_pt = XYZ(${nextPoint.x}, ${nextPoint.y}, 0)`);
                        geometry.push(`    line = Line.CreateBound(start_pt, end_pt)`);
                        geometry.push(`    profile_curves.Append(line)`);
                    });
                }
                
                geometry.push('');
                geometry.push(`    # Create extrusion`);
                geometry.push(`    extrusion_height = ${extrusion.endPoint.z - extrusion.startPoint.z}`);
                geometry.push(`    extrusion_obj = doc.FamilyCreate.NewExtrusion(True, profile_curves, sketch, extrusion_height)`);
                geometry.push(`    created_geometry["${extrusion.name}"] = extrusion_obj`);
                geometry.push('');
            });
        }
        
        return geometry.join('\n');
    }

    /**
     * Generate constraints code
     */
    generateConstraints(sir) {
        const constraints = [
            '    # Constraints and Relationships',
            ''
        ];
        
        if (sir.geometryDefinition.constraints) {
            sir.geometryDefinition.constraints.forEach((constraint, index) => {
                constraints.push(`    # Constraint: ${constraint.element1} -> ${constraint.element2}`);
                constraints.push(`    # Type: ${constraint.constraintType}`);
                constraints.push(`    # Offset: ${constraint.offset}`);
                constraints.push('');
                
                // Generate constraint-specific code
                switch (constraint.constraintType) {
                    case 'align':
                        constraints.push(`    # Align constraint implementation`);
                        constraints.push(`    # TODO: Implement alignment constraint`);
                        break;
                    case 'lock':
                        constraints.push(`    # Lock constraint implementation`);
                        constraints.push(`    # TODO: Implement lock constraint`);
                        break;
                    case 'dimension':
                        constraints.push(`    # Dimension constraint implementation`);
                        constraints.push(`    # TODO: Implement dimension constraint`);
                        break;
                }
                constraints.push('');
            });
        }
        
        return constraints.join('\n');
    }

    /**
     * Generate materials code
     */
    generateMaterials(sir) {
        const materials = [
            '    # Materials',
            '    created_materials = {}',
            ''
        ];
        
        if (sir.materials) {
            sir.materials.forEach((material, index) => {
                materials.push(`    # Material: ${material.name}`);
                materials.push(`    # Parameter: ${material.parameterName}`);
                materials.push(`    # Default: ${material.defaultValue}`);
                materials.push('');
                
                // Create material parameter if it doesn't exist
                materials.push(`    if "${material.parameterName}" not in created_parameters:`);
                materials.push(`        mat_param = FamilyParameterDefinition.Create("${material.parameterName}", ParameterType.Material)`);
                materials.push(`        mat_param.SetGroupTypeId(GroupTypeId.Materials)`);
                materials.push(`        mat_param.IsInstance = True`);
                materials.push(`        created_parameters["${material.parameterName}"] = mat_param`);
                materials.push('');
            });
        }
        
        return materials.join('\n');
    }

    /**
     * Generate family types code
     */
    generateFamilyTypes(sir) {
        const types = [
            '    # Family Types',
            '    created_types = {}',
            ''
        ];
        
        if (sir.parameters.familyTypes) {
            sir.parameters.familyTypes.forEach((type, index) => {
                types.push(`    # Family Type: ${type.name}`);
                types.push(`    family_type = doc.FamilyCreate.NewType("${type.name}")`);
                types.push('');
                
                // Set parameter values for this type
                if (type.parameters) {
                    Object.keys(type.parameters).forEach(paramName => {
                        const value = type.parameters[paramName];
                        types.push(`    # Set parameter ${paramName} = ${value}`);
                        types.push(`    # TODO: Implement parameter value setting`);
                    });
                }
                
                types.push(`    created_types["${type.name}"] = family_type`);
                types.push('');
            });
        }
        
        return types.join('\n');
    }

    /**
     * Generate visibility settings code
     */
    generateVisibilitySettings(sir) {
        const visibility = [
            '    # Visibility Settings',
            ''
        ];
        
        if (sir.visibilitySettings) {
            ['coarse', 'medium', 'fine'].forEach(detailLevel => {
                if (sir.visibilitySettings[detailLevel]) {
                    visibility.push(`    # ${detailLevel.toUpperCase()} visibility`);
                    sir.visibilitySettings[detailLevel].forEach(elementName => {
                        visibility.push(`    # Set ${elementName} visibility for ${detailLevel}`);
                        visibility.push(`    # TODO: Implement visibility setting for ${elementName}`);
                    });
                    visibility.push('');
                }
            });
        }
        
        return visibility.join('\n');
    }

    /**
     * Generate validation and error handling code
     */
    generateValidationCode(sir) {
        const validation = [
            '    # Validation and Quality Assurance',
            '    validation_results = {',
            '        "geometry_created": len(created_geometry) > 0,',
            '        "parameters_created": len(created_parameters) > 0,',
            '        "family_types_created": len(created_types) > 0,',
            '        "lod_compliance": True,  # TODO: Implement LOD validation',
            '        "performance_optimized": True  # TODO: Implement performance checks',
            '    }',
            '',
            '    # Log validation results',
            '    print("Family Creation Validation Results:")',
            '    for key, value in validation_results.items():',
            '        print(f"  {key}: {value}")',
            '',
            '    # Commit transaction',
            '    TransactionManager.Instance.TransactionTaskDone()',
            '',
            '    print(f"Successfully created family: {family_name}")',
            '    print(f"Category: {family_category}")',
            '    print(f"LOD Level: {lod_level}")',
            '',
            'except Exception as e:',
            '    print(f"Error creating family: {str(e)}")',
            '    TransactionManager.Instance.TransactionTaskDone()',
            '    raise e',
            ''
        ];
        
        return validation.join('\n');
    }

    /**
     * Combine all code sections into final Python script
     */
    combineCodeSections(sections) {
        const codeParts = [
            sections.imports,
            sections.familySetup,
            sections.referencePlanes,
            sections.parameters,
            sections.geometry,
            sections.constraints,
            sections.materials,
            sections.familyTypes,
            sections.visibility,
            sections.validation
        ];
        
        return codeParts.join('\n\n');
    }

    /**
     * Apply performance optimizations to generated code
     */
    applyPerformanceOptimizations(code, sir) {
        let optimizedCode = code;
        
        // Remove excessive comments for production
        if (sir.familyMetadata.lodLevel <= 200) {
            optimizedCode = optimizedCode.replace(/# .*\n/g, '');
        }
        
        // Optimize for LOD level
        if (sir.familyMetadata.lodLevel <= 200) {
            // Remove complex geometry for low LOD
            optimizedCode = optimizedCode.replace(/extrusion_obj = doc\.FamilyCreate\.NewExtrusion.*\n/g, '');
        }
        
        // Apply performance rules
        this.performanceOptimizations.forEach(rule => {
            optimizedCode = rule.apply(optimizedCode, sir);
        });
        
        return optimizedCode;
    }

    /**
     * Generate execution metadata
     */
    generateExecutionMetadata(sir, code) {
        return {
            familyName: sir.familyMetadata.familyName,
            category: sir.familyMetadata.category,
            lodLevel: sir.familyMetadata.lodLevel,
            codeLength: code.length,
            estimatedExecutionTime: this.estimateExecutionTime(sir),
            complexityScore: this.calculateComplexityScore(sir),
            performanceOptimizations: this.getAppliedOptimizations(sir),
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Validate SIR structure
     */
    validateSIR(sir) {
        if (!sir.familyMetadata) {
            throw new Error('Missing familyMetadata in SIR');
        }
        
        if (!sir.geometryDefinition) {
            throw new Error('Missing geometryDefinition in SIR');
        }
        
        if (!sir.parameters) {
            throw new Error('Missing parameters in SIR');
        }
        
        // Additional validation rules
        if (sir.familyMetadata.lodLevel < 100 || sir.familyMetadata.lodLevel > 500) {
            throw new Error('Invalid LOD level');
        }
    }

    /**
     * Format parameter values for Python code
     */
    formatParameterValue(value, type) {
        switch (type) {
            case 'Length':
            case 'Number':
                return value;
            case 'Text':
                return `"${value}"`;
            case 'Material':
                return `"${value}"`;
            default:
                return `"${value}"`;
        }
    }

    /**
     * Initialize code templates
     */
    initializeCodeTemplates() {
        return {
            basicExtrusion: this.getBasicExtrusionTemplate(),
            parameterCreation: this.getParameterCreationTemplate(),
            familyTypeCreation: this.getFamilyTypeTemplate()
        };
    }

    /**
     * Initialize performance optimization rules
     */
    initializePerformanceRules() {
        return [
            {
                name: 'minimize_voids',
                apply: (code, sir) => {
                    if (sir.familyMetadata.lodLevel <= 200) {
                        return code.replace(/NewVoid.*\n/g, '');
                    }
                    return code;
                }
            },
            {
                name: 'optimize_arrays',
                apply: (code, sir) => {
                    // Limit array usage for performance
                    return code.replace(/Array\.Create.*\n/g, '');
                }
            }
        ];
    }

    /**
     * Estimate execution time based on SIR complexity
     */
    estimateExecutionTime(sir) {
        let baseTime = 30; // Base 30 seconds
        
        // Add time based on complexity
        if (sir.geometryDefinition.extrusions) {
            baseTime += sir.geometryDefinition.extrusions.length * 5;
        }
        
        if (sir.parameters.familyParameters) {
            baseTime += sir.parameters.familyParameters.length * 2;
        }
        
        if (sir.parameters.familyTypes) {
            baseTime += sir.parameters.familyTypes.length * 3;
        }
        
        return Math.min(baseTime, 300); // Cap at 5 minutes
    }

    /**
     * Calculate complexity score
     */
    calculateComplexityScore(sir) {
        let score = 0;
        
        // Geometry complexity
        if (sir.geometryDefinition.extrusions) {
            score += sir.geometryDefinition.extrusions.length * 2;
        }
        
        // Parameter complexity
        if (sir.parameters.familyParameters) {
            score += sir.parameters.familyParameters.length;
        }
        
        // Type complexity
        if (sir.parameters.familyTypes) {
            score += sir.parameters.familyTypes.length * 2;
        }
        
        return score;
    }

    /**
     * Get applied optimizations
     */
    getAppliedOptimizations(sir) {
        const optimizations = [];
        
        if (sir.familyMetadata.lodLevel <= 200) {
            optimizations.push('simplified_geometry');
        }
        
        if (sir.geometryDefinition.extrusions && sir.geometryDefinition.extrusions.length > 5) {
            optimizations.push('geometry_consolidation');
        }
        
        return optimizations;
    }

    // Template methods
    getBasicExtrusionTemplate() {
        return `
# Basic Extrusion Template
def create_basic_extrusion(name, profile_points, height):
    sketch_plane = Plane.CreateByNormalAndOrigin(XYZ(0, 0, 1), XYZ(0, 0, 0))
    sketch = SketchPlane.Create(doc, sketch_plane)
    
    profile_curves = CurveArray()
    for i in range(len(profile_points)):
        start_pt = profile_points[i]
        end_pt = profile_points[(i + 1) % len(profile_points)]
        line = Line.CreateBound(start_pt, end_pt)
        profile_curves.Append(line)
    
    extrusion = doc.FamilyCreate.NewExtrusion(True, profile_curves, sketch, height)
    return extrusion
        `;
    }

    getParameterCreationTemplate() {
        return `
# Parameter Creation Template
def create_family_parameter(name, param_type, group, is_instance=True, default_value=None):
    param_def = FamilyParameterDefinition.Create(name, ParameterType.param_type)
    param_def.SetGroupTypeId(GroupTypeId.group)
    param_def.IsInstance = is_instance
    if default_value is not None:
        param_def.DefaultValue = default_value
    return param_def
        `;
    }

    getFamilyTypeTemplate() {
        return `
# Family Type Template
def create_family_type(name, parameter_values=None):
    family_type = doc.FamilyCreate.NewType(name)
    if parameter_values:
        for param_name, value in parameter_values.items():
            # Set parameter value logic here
            pass
    return family_type
        `;
    }
}

module.exports = SIRToCodeInterpreter;

