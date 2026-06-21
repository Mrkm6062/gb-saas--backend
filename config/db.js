import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Drop the old non-sparse index if it exists, so Mongoose can recreate it with sparse: true
    try {
      const db = conn.connection.db;
      const collections = await db.listCollections({ name: 'superadminstaffs' }).toArray();
      if (collections.length > 0) {
        await db.collection('superadminstaffs').dropIndex('CompanyEmail_1');
        console.log("Successfully dropped non-sparse CompanyEmail_1 index.");
      }
    } catch (indexError) {
      // If index doesn't exist, ignore the error
      if (indexError.codeName !== 'IndexNotFound') {
        console.warn("Index drop warning:", indexError.message);
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

export default connectDB;