require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

const migrate = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB...");

    const db = mongoose.connection.db;

    // 1. Expenses
    await db.collection("expenses").updateMany({}, { $mul: { amount: 100 } });
    console.log("✅ Expenses migrated");

    // 2. Donations
    await db.collection("donations").updateMany({}, { $mul: { amount: 100 } });
    console.log("✅ Donations migrated");

    // 3. MemberFees
    await db.collection("memberfees").updateMany({}, { $mul: { amount: 100 } });
    console.log("✅ MemberFees migrated");

    // 4. FestivalYears
    await db.collection("festivalyears").updateMany({}, { 
      $mul: { 
        amountPerInstallment: 100,
        openingBalance: 100,
        closingBalance: 100
      } 
    });
    console.log("✅ Years migrated");

    // 5. Clubs
    await db.collection("clubs").updateMany({}, { 
      $mul: { "settings.defaultAmountPerInstallment": 100 } 
    });
    console.log("✅ Clubs migrated");

    // 6. Subscriptions (Tricky: Nested Arrays)
    // First, update the root totals
    await db.collection("subscriptions").updateMany({}, { 
      $mul: { totalPaid: 100, totalDue: 100 } 
    });
    
    // Now update every element in the installments array
    // Note: $mul with array filters is complex, simpler to loop for safety in migration
    const subs = await db.collection("subscriptions").find({}).toArray();
    let subCount = 0;
    
    for (const sub of subs) {
      if (!sub.installments) continue;
      
      const newInstallments = sub.installments.map(i => ({
        ...i,
        amountExpected: Math.round(i.amountExpected * 100) // Convert to integer
      }));

      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { $set: { installments: newInstallments } }
      );
      subCount++;
    }
    console.log(`✅ ${subCount} Subscriptions migrated`);

    console.log("🎉 MIGRATION COMPLETE");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

migrate();