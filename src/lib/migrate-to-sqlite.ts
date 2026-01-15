/**
 * Migration utility to migrate data from IndexedDB to SQLite
 */
import { openDB } from 'idb';
import { getSQLiteDB } from './database-sqlite';

export async function migrateFromIndexedDBToSQLite(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('Starting migration from IndexedDB to SQLite...');
    
    // Open IndexedDB
    let idb: any;
    try {
      idb = await openDB('FastFoodPOS', 3);
    } catch (error) {
      return { success: false, message: 'IndexedDB not found or cannot be accessed' };
    }
    
    // Get SQLite database
    const sqliteDB = await getSQLiteDB();
    
    // Migrate categories
    if (idb.objectStoreNames.contains('categories')) {
      const categories = await idb.getAll('categories');
      console.log(`Migrating ${categories.length} categories...`);
      for (const cat of categories) {
        await sqliteDB.putCategory(cat);
      }
    }
    
    // Migrate products
    if (idb.objectStoreNames.contains('products')) {
      const products = await idb.getAll('products');
      console.log(`Migrating ${products.length} products...`);
      for (const product of products) {
        await sqliteDB.putProduct(product);
      }
    }
    
    // Migrate product variants
    if (idb.objectStoreNames.contains('productVariants')) {
      const variants = await idb.getAll('productVariants');
      console.log(`Migrating ${variants.length} product variants...`);
      for (const variant of variants) {
        await sqliteDB.putVariant(variant);
      }
    }
    
    // Migrate modifier groups
    if (idb.objectStoreNames.contains('modifierGroups')) {
      const groups = await idb.getAll('modifierGroups');
      console.log(`Migrating ${groups.length} modifier groups...`);
      for (const group of groups) {
        await sqliteDB.putModifierGroup(group);
      }
    }
    
    // Migrate modifier options
    if (idb.objectStoreNames.contains('modifierOptions')) {
      const options = await idb.getAll('modifierOptions');
      console.log(`Migrating ${options.length} modifier options...`);
      for (const option of options) {
        await sqliteDB.putModifierOption(option);
      }
    }
    
    // Migrate orders
    if (idb.objectStoreNames.contains('orders')) {
      const orders = await idb.getAll('orders');
      console.log(`Migrating ${orders.length} orders...`);
      for (const order of orders) {
        await sqliteDB.putOrder(order);
      }
    }
    
    // Migrate printers
    if (idb.objectStoreNames.contains('printers')) {
      const printers = await idb.getAll('printers');
      console.log(`Migrating ${printers.length} printers...`);
      for (const printer of printers) {
        await sqliteDB.putPrinter(printer);
      }
    }
    
    // Migrate promotions
    if (idb.objectStoreNames.contains('promotions')) {
      const promotions = await idb.getAll('promotions');
      console.log(`Migrating ${promotions.length} promotions...`);
      for (const promo of promotions) {
        await sqliteDB.putPromotion(promo);
      }
    }
    
    // Migrate settings
    if (idb.objectStoreNames.contains('settings')) {
      const settings = await idb.getAll('settings');
      console.log(`Migrating ${settings.length} settings...`);
      for (const setting of settings) {
        await sqliteDB.putSettings(setting);
      }
    }
    
    // Migrate numbering counters
    if (idb.objectStoreNames.contains('numberingCounters')) {
      const counters = await idb.getAll('numberingCounters');
      console.log(`Migrating ${counters.length} numbering counters...`);
      for (const counter of counters) {
        await sqliteDB.putNumberingCounter(counter);
      }
    }
    
    // Migrate users
    if (idb.objectStoreNames.contains('users')) {
      const users = await idb.getAll('users');
      console.log(`Migrating ${users.length} users...`);
      for (const user of users) {
        await sqliteDB.putUser(user);
      }
    }
    
    // Migrate user sessions
    if (idb.objectStoreNames.contains('userSessions')) {
      const sessions = await idb.getAll('userSessions');
      console.log(`Migrating ${sessions.length} user sessions...`);
      for (const session of sessions) {
        await sqliteDB.putUserSession(session);
      }
    }
    
    idb.close();
    
    console.log('Migration completed successfully!');
    return { success: true, message: 'Migration completed successfully' };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, message: `Migration failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
