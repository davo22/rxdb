"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompressionState = createCompressionState;
exports.getCompressionStateByStorageInstance = getCompressionStateByStorageInstance;
exports.RxDBKeyCompressionPlugin = exports.overwritable = exports.prototypes = exports.rxdb = void 0;

var _jsonschemaKeyCompression = require("jsonschema-key-compression");

/**
 * this plugin adds the keycompression-capabilities to rxdb
 * if you dont use this, ensure that you set disableKeyComression to false in your schema
 */

/**
 * Cache the compression table and the compressed schema
 * by the storage instance for better performance.
 */
var COMPRESSION_STATE_BY_COLLECTION = new WeakMap();

function createCompressionState(schema) {
  var primaryPath = schema.primaryKey;
  var table = (0, _jsonschemaKeyCompression.createCompressionTable)(schema, _jsonschemaKeyCompression.DEFAULT_COMPRESSION_FLAG, [
  /**
   * Do not compress the primary path
   * to make it easier to debug errors.
   */
  primaryPath, '_rev', '_attachments', '_deleted']);
  var compressedSchema = (0, _jsonschemaKeyCompression.createCompressedJsonSchema)(table, schema);
  /**
   * the key compression module does not know about indexes
   * in the schema, so we have to also compress them here.
   */

  if (schema.indexes) {
    var newIndexes = schema.indexes.map(function (idx) {
      if (Array.isArray(idx)) {
        return idx.map(function (subIdx) {
          return (0, _jsonschemaKeyCompression.compressedPath)(table, subIdx);
        });
      } else {
        return (0, _jsonschemaKeyCompression.compressedPath)(table, idx);
      }
    });
    compressedSchema.indexes = newIndexes;
  }

  return {
    table: table,
    schema: compressedSchema
  };
}

function getCompressionStateByStorageInstance(collection) {
  var state = COMPRESSION_STATE_BY_COLLECTION.get(collection);

  if (!state) {
    state = createCompressionState(collection.schema.jsonSchema);
    COMPRESSION_STATE_BY_COLLECTION.set(collection, state);
  }

  return state;
}

var rxdb = true;
exports.rxdb = rxdb;
var prototypes = {};
exports.prototypes = prototypes;
var overwritable = {};
exports.overwritable = overwritable;
var RxDBKeyCompressionPlugin = {
  name: 'key-compression',
  rxdb: rxdb,
  prototypes: prototypes,
  overwritable: overwritable,
  hooks: {
    /**
     * replace the keys of a query-obj with the compressed keys
     * because the storage instance only know the compressed schema
     * @return compressed queryJSON
     */
    prePrepareQuery: function prePrepareQuery(input) {
      var rxQuery = input.rxQuery;
      var mangoQuery = input.mangoQuery;

      if (!rxQuery.collection.schema.jsonSchema.keyCompression) {
        return;
      }

      var compressionState = getCompressionStateByStorageInstance(rxQuery.collection);
      var compressedQuery = (0, _jsonschemaKeyCompression.compressQuery)(compressionState.table, mangoQuery);
      input.mangoQuery = compressedQuery;
    },
    preCreateRxStorageInstance: function preCreateRxStorageInstance(params) {
      /**
       * When key compression is used,
       * the storage instance only knows about the compressed schema
       */
      if (params.schema.keyCompression) {
        var compressionState = createCompressionState(params.schema);
        params.schema = compressionState.schema;
      }
    },
    preQueryMatcher: function preQueryMatcher(params) {
      if (!params.rxQuery.collection.schema.jsonSchema.keyCompression) {
        return;
      }

      var state = getCompressionStateByStorageInstance(params.rxQuery.collection);
      params.doc = (0, _jsonschemaKeyCompression.compressObject)(state.table, params.doc);
    },
    preSortComparator: function preSortComparator(params) {
      if (!params.rxQuery.collection.schema.jsonSchema.keyCompression) {
        return;
      }

      var state = getCompressionStateByStorageInstance(params.rxQuery.collection);
      params.docA = (0, _jsonschemaKeyCompression.compressObject)(state.table, params.docA);
      params.docB = (0, _jsonschemaKeyCompression.compressObject)(state.table, params.docB);
    },
    preWriteToStorageInstance: function preWriteToStorageInstance(params) {
      if (!params.collection.schema.jsonSchema.keyCompression) {
        return;
      }

      var state = getCompressionStateByStorageInstance(params.collection);
      params.doc = (0, _jsonschemaKeyCompression.compressObject)(state.table, params.doc);
    },
    postReadFromInstance: function postReadFromInstance(params) {
      if (!params.collection.schema.jsonSchema.keyCompression) {
        return;
      }

      var state = getCompressionStateByStorageInstance(params.collection);
      params.doc = (0, _jsonschemaKeyCompression.decompressObject)(state.table, params.doc);
    }
  }
};
exports.RxDBKeyCompressionPlugin = RxDBKeyCompressionPlugin;

//# sourceMappingURL=key-compression.js.map