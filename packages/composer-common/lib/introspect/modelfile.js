/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const parser = require('./parser');
const AssetDeclaration = require('./assetdeclaration');
const EnumDeclaration = require('./enumdeclaration');
const ConceptDeclaration = require('./conceptdeclaration');
const ParticipantDeclaration = require('./participantdeclaration');
const TransactionDeclaration = require('./transactiondeclaration');
const IllegalModelException = require('./illegalmodelexception');
const ParseException = require('./parseexception');
const ModelUtil = require('../modelutil');
const Globalize = require('../globalize');

/**
 * Class representing a Model File. A Model File contains a single namespace
 * and a set of model elements: assets, transactions etc.
 * @private
 * @class
 * @memberof module:composer-common
 */
class ModelFile {

    /**
     * Create a ModelFile. This should only be called by framework code.
     * Use the ModelManager to manage ModelFiles.
     *
     * @param {ModelManager} modelManager - the ModelManager that manages this
     * ModelFile
     * @param {string} definitions - The DSL model as a string.
     * @throws {InvalidModelException}
     */
    constructor(modelManager, definitions) {
        this.modelManager = modelManager;
        this.declarations = [];
        this.imports = [];

        if(!definitions || typeof definitions !== 'string') {
            throw new Error('ModelFile expects a Concerto model as a string as input.');
        }
        this.definitions = definitions;

        try {
            this.ast = parser.parse(definitions);
        }
        catch(err) {
            if(err.location && err.location.start) {
                throw new ParseException( err.message +  ' Line ' + err.location.start.line + ' column ' + err.location.start.column );
            }
            else {
                throw err;
            }
        }

        this.namespace = this.ast.namespace;

        if(this.ast.imports) {
            this.imports = this.ast.imports;
        }

        for(let n=0; n < this.ast.body.length; n++ ) {
            let thing = this.ast.body[n];

            if(thing.type === 'AssetDeclaration') {
                this.declarations.push( new AssetDeclaration(this, thing) );
            }
            else if(thing.type === 'TransactionDeclaration') {
                this.declarations.push( new TransactionDeclaration(this, thing) );
            }
            else if(thing.type === 'ParticipantDeclaration') {
                this.declarations.push( new ParticipantDeclaration(this, thing) );
            }
            else if(thing.type === 'EnumDeclaration') {
                this.declarations.push( new EnumDeclaration(this, thing) );
            }
            else if(thing.type === 'ConceptDeclaration') {
                this.declarations.push( new ConceptDeclaration(this, thing) );
            }
            else {
                let formatter = Globalize('en').messageFormatter('modelfile-constructor-unrecmodelelem');

                throw new IllegalModelException(formatter({
                    'type': thing.type,
                }));
            }
        }
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    accept(visitor,parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the ModelManager associated with this ModelFile
     *
     * @return {ModelManager} The ModelManager for this ModelFile
     */
    getModelManager() {
        return this.modelManager;
    }

    /**
     * Returns the types that have been imported into this ModelFile.
     *
     * @return {string[]} The array of imports for this ModelFile
     */
    getImports() {
        return this.imports;
    }

    /**
     * Validates the ModelFile.
     *
     * @throws {IllegalModelException} if the model is invalid
     * @private
     */
    validate() {
        for(let n=0; n < this.declarations.length; n++) {
            let classDeclaration = this.declarations[n];
            classDeclaration.validate();
        }
    }

    /**
     * Check that the type is valid.
     * @param {string} context - error reporting context
     * @param {string} type - a short type name
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    resolveType(context,type) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    let formatter = Globalize('en').messageFormatter('modelfile-resolvetype-undecltype');
                    throw new IllegalModelException(formatter({
                        'type': type,
                        'context': context
                    }));
                }
            }
            else {
                // check whether type is defined in another file
                this.getModelManager().resolveType(context,this.resolveImport(type));
            }
        }
    }

    /**
     * Returns true if the type is defined in this namespace.
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is defined in this ModelFile
     * @private
     */
    isLocalType(type) {
        let result = (type !== null && this.getLocalType(type) !== null);
        //console.log('isLocalType ' + this.getNamespace() + ' ' + type + '=' + result );
        return result;
    }

    /**
     * Returns true if the type is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is imported from another namespace
     * @private
     */
    isImportedType(type) {
        //console.log('isImportedType ' + this.getNamespace() + ' ' + type );
        for(let n=0; n < this.imports.length; n++) {
            let importName = this.imports[n];
            if( ModelUtil.getShortName(importName) === type ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the FQN for a type that is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {string} - the FQN of the resolved import
     * @throws {Error} - if the type is not imported
     * @private
     */
    resolveImport(type) {
        //console.log('resolveImport ' + this.getNamespace() + ' ' + type );

        for(let n=0; n < this.imports.length; n++) {
            let importName = this.imports[n];
            if( ModelUtil.getShortName(importName) === type ) {
                return importName;
            }
        }
        let formatter = Globalize('en').messageFormatter('modelfile-resolveimport-failfindimp');

        throw new IllegalModelException(formatter({
            'type': type,
            'imports': this.imports,
            'namespace': this.getNamespace()
        }));
    }

    /**
     * Returns true if the type is defined in the model file
     * @param {string} type the name of the type
     * @return {boolean} true if the type (asset or transaction) is defined
     */
    isDefined(type) {
        return ModelUtil.isPrimitiveType(type) || this.getLocalType(type) !== null;
    }

    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string | ClassDeclaration} the class declaration for the type or null.
     * @private
     */
    getType(type) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    return null;
                }
                else {
                    return this.getLocalType(type);
                }
            }
            else {
                // check whether type is defined in another file
                const fqn = this.resolveImport(type);
                const modelFile = this.getModelManager().getModelFile(ModelUtil.getNamespace(fqn));
                if (!modelFile) {
                    return null;
                } else {
                    return modelFile.getLocalType(fqn);
                }
            }
        }
        else {
            // for primitive types we just return the name
            return type;
        }
    }

    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the short type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string} the FQN type name or null
     * @private
     */
    getFullyQualifiedTypeName(type) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    return null;
                }
                else {
                    return this.getLocalType(type).getFullyQualifiedName();
                }
            }
            else {
                // check whether type is defined in another file
                const fqn = this.resolveImport(type);
                const modelFile = this.getModelManager().getModelFile(ModelUtil.getNamespace(fqn));
                return modelFile.getLocalType(fqn).getFullyQualifiedName();
            }
        }
        else {
            // for primitive types we just return the name
            return type;
        }
    }

    /**
     * Returns the type with the specified name or null
     * @param {string} type the short OR FQN name of the type
     * @return {ClassDeclaration} the ClassDeclaration, or null if the type does not exist
     */
    getLocalType(type) {
        if(!type.startsWith(this.getNamespace())) {
            type = this.getNamespace() + '.' + type;
        }

        for(let n=0; n < this.declarations.length; n++) {
            let classDeclaration = this.declarations[n];
            if(type === this.getNamespace() + '.' + classDeclaration.getName() ) {
                return classDeclaration;
            }
        }
        return null;
    }

    /**
     * Get the AssetDeclarations defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {AssetDeclaration} the AssetDeclaration with the given short name
     */
    getAssetDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration instanceof AssetDeclaration) {
            return classDeclaration;
        }

        return null;
    }

    /**
     * Get the TransactionDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {TransactionDeclaration} the TransactionDeclaration with the given short name
     */
    getTransactionDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration instanceof TransactionDeclaration) {
            return classDeclaration;
        }

        return null;
    }

    /**
     * Get the ParticipantDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {ParticipantDeclaration} the ParticipantDeclaration with the given short name
     */
    getParticipantDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration instanceof ParticipantDeclaration) {
            return classDeclaration;
        }

        return null;
    }


    /**
     * Get the Namespace for this model file.
     * @return {string} The Namespace for this model file
     */
    getNamespace() {
        return this.namespace;
    }

    /**
     * Get the AssetDeclarations defined in this ModelFile
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model file
     */
    getAssetDeclarations() {
        return this.getDeclarations(AssetDeclaration);
    }

    /**
     * Get the TransactionDeclarations defined in this ModelFile
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model file
     */
    getTransactionDeclarations() {
        return this.getDeclarations(TransactionDeclaration);
    }

    /**
     * Get the ParticipantDeclarations defined in this ModelFile
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getParticipantDeclarations() {
        return this.getDeclarations(ParticipantDeclaration);
    }

    /**
     * Get the ConceptDeclarations defined in this ModelFile
     * @return {ConceptDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getConceptDeclarations() {
        return this.getDeclarations(ConceptDeclaration);
    }

    /**
     * Get the EnumDeclarations defined in this ModelFile
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model file
     */
    getEnumDeclarations() {
        return this.getDeclarations(EnumDeclaration);
    }

    /**
     * Get the instances of a given type in this ModelFile
     * @param {Function} type - the type of the declaration
     * @return {ClassDeclaration[]} the ClassDeclaration defined in the model file
     */
    getDeclarations(type) {
        let result = [];
        for(let n=0; n < this.declarations.length; n++) {
            let classDeclaration = this.declarations[n];
            if(classDeclaration instanceof type) {
                result.push(classDeclaration);
            }
        }
        return result;
    }

    /**
     * Get all declarations in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getAllDeclarations() {
        return this.declarations;
    }

    /**
     * Get the definitions for this model.
     * @return {string} The definitions for this model.
     */
    getDefinitions() {
        return this.definitions;
    }

    /**
     * Return an object suitable for serialization.
     * @return {Object} An object suitable for serialization.
     */
    toJSON() {
        return {};
    }

}

module.exports = ModelFile;
