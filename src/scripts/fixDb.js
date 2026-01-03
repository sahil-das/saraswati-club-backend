const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const fixAmount = async () => {
  try {
    // 1. Connect
    await mongoose.connect(process.env.MONGO_URI, { dbName: "saraswati_saas" });
    console.log("🔌 Connected...");

    // 2. Define the correct amount
    const NEW_AMOUNT = 20; // <--- CHANGE THIS IF YOU WANT ₹50 or ₹100

    // 3. Update the Active Year
    const yearResult = await mongoose.connection.collection("festivalyears").updateOne(
      { isActive: true },
      { $set: { amountPerInstallment: NEW_AMOUNT } }
    );
    console.log(`✅ Updated Active Year Rule: ₹${NEW_AMOUNT}`);

    // 4. Update Existing Subscriptions
    // We update the 'amountExpected' for every installment inside the array
    const subResult = await mongoose.connection.collection("subscriptions").updateMany(
      {}, 
      { 
        $set: { "installments.$[].amountExpected": NEW_AMOUNT } 
      }
    );
    console.log(`✅ Updated ${subResult.modifiedCount} Member Subscriptions to ₹${NEW_AMOUNT}`);

    // 5. Recalculate 'Total Due' for everyone
    // (Since amount changed, the total due must increase)
    const subscriptions = await mongoose.connection.collection("subscriptions").find({}).toArray();
    
    for (const sub of subscriptions) {
      const totalPaid = sub.installments.filter(i => i.isPaid).length * NEW_AMOUNT;
      const totalDue = sub.installments.filter(i => !i.isPaid).length * NEW_AMOUNT;
      
      await mongoose.connection.collection("subscriptions").updateOne(
        { _id: sub._id },
        { $set: { totalPaid, totalDue } }
      );
    }
    console.log("✅ Recalculated all totals.");

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixAmount();