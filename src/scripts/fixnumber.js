require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

const fix = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB for Repair...");

    const db = mongoose.connection.db;

    // We multiply by 0.01 to effectively divide by 100
    const factor = 0.01;

    // 1. Expenses
    await db.collection("expenses").updateMany({}, { $mul: { amount: factor } });
    
    // 2. Donations
    await db.collection("donations").updateMany({}, { $mul: { amount: factor } });

    // 3. MemberFees
    await db.collection("memberfees").updateMany({}, { $mul: { amount: factor } });

    // 4. FestivalYears
    await db.collection("festivalyears").updateMany({}, { 
      $mul: { 
        amountPerInstallment: factor,
        openingBalance: factor,
        closingBalance: factor
      } 
    });

    // 5. Clubs
    await db.collection("clubs").updateMany({}, { 
      $mul: { "settings.defaultAmountPerInstallment": factor } 
    });

    // 6. Subscriptions
    await db.collection("subscriptions").updateMany({}, { 
      $mul: { totalPaid: factor, totalDue: factor } 
    });
    
    const subs = await db.collection("subscriptions").find({}).toArray();
    for (const sub of subs) {
      if (!sub.installments) continue;
      const fixedInstallments = sub.installments.map(i => ({
        ...i,
        amountExpected: Math.round(i.amountExpected * factor)
      }));
      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { $set: { installments: fixedInstallments } }
      );
    }

    // 7. Remove the migration flag so you can run the proper safe script later
    await db.collection("migration_status").deleteMany({ name: "integer_migration" });

    console.log("✅ Data successfully restored to single-migration state.");
    process.exit();
  } catch (err) {
    console.error("❌ Fix failed:", err);
    process.exit(1);
  }
};

fix();