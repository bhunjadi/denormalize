import _ from 'lodash'
import {Mongo} from 'meteor/mongo'
import settings from './cache.js'

export const MigrationHistory = new Mongo.Collection('_cacheMigrations')

let migrations = []

export function addMigration(collection, insertFn, options){
  let opts = _.clone(options)
  if(opts.collection){ //prevent Error: Converting circular structure to JSON
    opts.collection = opts.collection._name
  }
  migrations.push({
    options:opts,
    collectionName:collection._name,
    collection:collection,
    cacheField:options.cacheField,
    fn:insertFn
  })
}

export function migrate(collectionName, cacheField, selector){
  let migration = _.find(migrations, {collectionName, cacheField})
  if(!migration){
    throw new Error('no migration found for ' + collectionName + ' - ' + cacheField)
  } else {
    let time = new Date()
    let n = 0

    const fields = _.isArray(migration.options.fields)
      ? migration.options.fields.reduce((acc, key) => ({
        ...acc,
        [key]: 1,
      }), {})
      : undefined
      
    migration.collection.find(selector || {}, {fields}).forEach(doc => {
      migration.fn(null, doc)
      n++
    })
    console.log(`migrated ${cacheField} of ${n} docs in ${collectionName + (selector ? ' matching ' + JSON.stringify(selector) : '')}. It took ${new Date() - time}ms`)
  }
}

export function autoMigrate(){
  _.each(migrations, migration => {
    const stringifiedOptions = JSON.stringify(migration.options);
    if(!MigrationHistory.findOne({collectionName:migration.collectionName, options:stringifiedOptions})){
      migrate(migration.collectionName, migration.cacheField)
      MigrationHistory.insert({
        collectionName:migration.collectionName,
        options:migration.options,
        date:new Date()
      })
    }    
  })
}