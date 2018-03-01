function replaceRequireds(schema) {
    const newSchema = JSON.parse(JSON.stringify(schema));

    function removeRequireds(schema) {
        if (Array.isArray(schema.required)) {
            delete schema.required;
        }

        Object.keys(schema).forEach(key => {
            if (typeof schema[key] === 'object') {
                removeRequireds(schema[key]);
            }
        });
    }

    function fixRequireds(schema) {
        if (schema.required1) {
            schema.required = true;
            delete schema.required1;
        }

        Object.keys(schema).forEach(key => {
            if (typeof schema[key] === 'object') {
                fixRequireds(schema[key]);
            }
        });
    }

    removeRequireds(newSchema);
    fixRequireds(newSchema);

    return newSchema;
}

module.exports = (schema, innerSchema) => {
    let resolvedRefs;

    try {
        // declared here because it can fail with "stackoverflow error. these errors can be catched only in such way"
        resolvedRefs = (function resolveRefs(commonSchema, schema, cachedRefs = []) {

            const newSchema = JSON.parse(JSON.stringify(schema));

            if (newSchema.required) {
                const isArray = Array.isArray(newSchema.required);

                if (isArray) {
                    newSchema.required.forEach(requiredPropName => {
                        newSchema.properties[requiredPropName].required1 = true;
                    });
                }
            }

            return Object.keys(newSchema).reduce((obj, key) => {
                if (typeof newSchema[key] === 'object' && !Array.isArray(newSchema[key])) {
                    obj[key] = resolveRefs(commonSchema, newSchema[key], cachedRefs);

                    if (!obj[key].type && obj[key].properties) {
                        obj[key].type = 'object';
                    }

                    return obj;
                }

                if (key !== '$ref') {
                    obj[key] = newSchema[key];

                    return obj;
                }

                const referedObjName = newSchema[key].replace('#/definitions/', '');
                const referedObj = commonSchema.definitions[referedObjName];

                if (cachedRefs.includes(referedObjName)) {
                    return {
                        type: referedObj.type,
                        description: `this field is the reference to ${referedObjName}`
                    };
                }

                const resolvedRef = resolveRefs(commonSchema, referedObj, cachedRefs.concat([referedObjName]));

                if (!resolvedRef.type && resolvedRef.properties) {
                    resolvedRef.type = 'object';
                }

                return resolvedRef;
            }, {});
        })(schema, innerSchema);

    } catch (e) {
        throw e;
    }

    return replaceRequireds(resolvedRefs);
}
