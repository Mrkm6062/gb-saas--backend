import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Drop the old non-sparse index if it exists, so Mongoose can recreate it with sparse: true
    const db = conn.connection.db;
    try {
      const collections = await db.listCollections({ name: 'superadminstaffs' }).toArray();
      if (collections.length > 0) {
        await db.collection('superadminstaffs').dropIndex('CompanyEmail_1');
        console.log("Successfully dropped non-sparse CompanyEmail_1 index.");
      }
    } catch (indexError) {
      if (indexError.codeName !== 'IndexNotFound') {
        console.warn("superadminstaffs index drop warning:", indexError.message);
      }
    }

    // Drop the old unique type_1 index on platformpolicies so we can have multiple documents with same type (e.g. salary, commission)
    try {
      const collections = await db.listCollections({ name: 'platformpolicies' }).toArray();
      if (collections.length > 0) {
        await db.collection('platformpolicies').dropIndex('type_1');
        console.log("Successfully dropped type_1 index on platformpolicies.");
      }
    } catch (indexError) {
      if (indexError.codeName !== 'IndexNotFound') {
        console.warn("platformpolicies index drop warning:", indexError.message);
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

export default connectDB;