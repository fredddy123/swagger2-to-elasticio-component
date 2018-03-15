const fs = require('fs');
const rmdir = require('rmdir');
const copydir = require('copy-dir');

const genEIOJsonSchFromSwaggerJsonSch = require('./convert_schema.js');

const DESCRIPTOR_PATH = './component/component.json';
const PACKAGE_JSON_PATH = './component/package.json';

let swaggerFile;

const errors = [];

(async () => {
    await createComponentDir();

    swaggerFile = require('./spec.json');

    fillDescriptorInfo();
    await writeMetaToPackageJson({
        fileName: 'sample_swagger_file.json'
    });

    for (const path in swaggerFile.paths) {
        console.log('path', path);
        for (const httpMethod in swaggerFile.paths[path]) {
            console.log('   httpMethod', httpMethod);
            await setupFunction({
                data: swaggerFile.paths[path][httpMethod],
                httpMethod,
                path
            });
        }
    }

    fs.writeFileSync('./component/.errors.json', JSON.stringify(errors, null, '\t'));
})().then(process.exit, console.error);

function fillDescriptorInfo() {
    const descriptor = require(DESCRIPTOR_PATH);
    descriptor.title = swaggerFile.info.title;
    descriptor.description = swaggerFile.info.description || '';
    fs.writeFileSync(DESCRIPTOR_PATH, JSON.stringify(descriptor, null, '\t'));
}

async function createComponentDir() {
    const COMPONET_DIR_NAME = 'component';
    const RELATIVE_COMP_DIR_PATH = `./${COMPONET_DIR_NAME}`;

    if (fs.existsSync(RELATIVE_COMP_DIR_PATH)) {
        await new Promise((res, rej) => {
            rmdir(RELATIVE_COMP_DIR_PATH, (err, dirs, files) => {
                if (err) {
                    return rej(err);
                }

                res();
            });
        });
    }

    fs.mkdirSync(RELATIVE_COMP_DIR_PATH);

    copydir.sync('./.component_structure', './component');
}

async function setupFunction({data, httpMethod, path}) {
    const tag = data.tags[0]; // `${data.tags[0][0].toUpperCase()}${data.tags[0].slice(1)}`;

    const pathForFileName = path
        .replace(/\//g, '_')
        .replace(/[\{\}]/g, '8')
        .replace(/\-/g, '7');

    const functionName = `${httpMethod}_${tag}${pathForFileName}`;
    const functionLabel = `${httpMethod.toUpperCase()} ${tag} ${path}`;
    console.log('       functionName', functionName);

    // const funcType = httpMethod === 'get' ? 'triggers' : 'actions';
    const funcType = 'actions';

    const mainFileName =`./lib/${funcType}/${functionName}.js`;
    const metadataInFileName = `./lib/schemas/${functionName}.in.json`;
    const metadataOutFileName = `./lib/schemas/${functionName}.out.json`;

    const schemasToSkip = await createSchemas({
        metadataInFileName,
        metadataOutFileName,
        data
    });

    await writeMetaToDescriptor({
        funcType,
        functionName,
        mainFileName,
        metadataInFileName,
        metadataOutFileName,
        schemasToSkip,
        functionLabel
    });

    await createScript({
        filePath: mainFileName,
        reqPath: path,
        httpMethod
    });
}

async function writeMetaToPackageJson({fileName}) {
    const packageJson = require(PACKAGE_JSON_PATH);

    packageJson.name = `@elasticio/eio-component-${fileName}`;
    packageJson.description = `elastic.io component generated from swagger file ${fileName}`;

    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, '\t'));
}

async function writeMetaToDescriptor(opts) {
    const {
        funcType,
        functionName,
        mainFileName,
        metadataInFileName,
        metadataOutFileName,
        schemasToSkip,
        functionLabel
    } = opts;

    const descriptor = require(DESCRIPTOR_PATH);

    const fileName = functionName.split(' ').join('_');

    const metadata = {};

    if (!schemasToSkip.includes(metadataInFileName)) {
        metadata.in = metadataInFileName;
    }

    if (!schemasToSkip.includes(metadataOutFileName)) {
        metadata.out = metadataOutFileName;
    }

    descriptor[funcType][functionName] = {
        title: functionLabel,
        main: mainFileName,
        metadata
    }

    fs.writeFileSync(DESCRIPTOR_PATH, JSON.stringify(descriptor, null, '\t'));
}

async function createSchemas(opts) {
    const {
        metadataInFileName,
        metadataOutFileName,
        data
    } = opts;

    const schemasToSkip = [];

    if (data.parameters) {
        writeInMetadata();
    } else {
        schemasToSkip.push(metadataInFileName);
    }

    writeOutMetadata();

    function writeInMetadata() {
        const eioSchema = data.parameters.reduce((obj, param) => {
            if (param.in === 'body') {
                try {
                    obj.properties.body = genEIOJsonSchFromSwaggerJsonSch(swaggerFile, param.schema);

                    if (!obj.properties.body.type) {
                        obj.properties.body.type = 'object';
                    }
                } catch (error) {
                    console.log(error.message);

                    errors.push({
                        metadataInFileName,
                        message: error.toString(),
                        stack: error.stack.toString(),
                        "data.responses": JSON.stringify(data.responses)
                    });

                    return obj;
                }

                return obj;
            }

            obj.properties[param.in] = obj.properties[param.in] || {
                type: 'object',
                properties: {}
            };

            obj.properties[param.in].properties[param.name] = {
                type: param.type,
                required: !!param.required
            };

            return obj;
        }, {
            type: 'object',
            properties: {
                additionalCreds: {
                    type: 'object',
                    properties: {
                        headers: {
                            type: 'string'
                        },
                        queryString: {
                            type: 'string'
                        },
                        apiURI: {
                            type: 'string'
                        }
                    }
                }
            }
        });

        fs.writeFileSync(`./component/${metadataInFileName.slice(2)}`, JSON.stringify(eioSchema, null, '\t'));
        // if (funcType === 'actions') {
        //     fs.writeFileSync(`./component/${metadataInFileName.slice(2)}`, JSON.stringify(eioSchema, null, '\t'));
        // } else {
        //     const descriptor = require(DESCRIPTOR_PATH);
        //     descriptor.triggers[functionName].fields = eioSchema.properties;
        //     fs.writeFileSync(DESCRIPTOR_PATH, JSON.stringify(descriptor, null, '\t'));
        // }
    }

    function writeOutMetadata() {
        let eioSchema;

        try {
            const response = (data.responses[200] || data.responses[204] || data.responses.default);

            if (!response || !response.schema) {
                eioSchema = {
                    description: `There is no schema for this response. ${response ? 'Source value: ' + JSON.stringify(response) : ''}`
                }
            } else {
                eioSchema = genEIOJsonSchFromSwaggerJsonSch(
                    swaggerFile,
                    response.schema
                );
            }

        } catch (error) {
            console.log(error.message);

            errors.push({
                metadataOutFileName,
                message: error.toString(),
                stack: error.stack.toString(),
                "data.responses": JSON.stringify(data.responses)
            });

            return;
        }

        fs.writeFileSync(`./component/${metadataOutFileName.slice(2)}`, JSON.stringify(eioSchema, null, '\t'));
    }

    return schemasToSkip;
}

function createScript(opts) {
    const {
        filePath,
        reqPath,
        httpMethod
    } = opts;

    const content = fs
        .readFileSync('./.function_template.js')
        .toString()
        .replace('<<<uri>>>', reqPath)
        .replace('<<<method>>>', httpMethod);

    fs.writeFileSync(`./component/${filePath}`, content);
}
