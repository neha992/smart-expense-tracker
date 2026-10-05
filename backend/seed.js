require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const { Transaction } = require('./src/models/Transaction');

const seedData = async () => {
  try {
    let mongoServer;
    if (process.env.USE_MEMORY_DB) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      await connectDB(mongoServer.getUri());
    } else {
      await connectDB();
    }

    console.log('Clearing existing demo data...');
    await User.deleteMany({ email: 'demo@example.com' });
    
    const demoUser = await User.create({
      name: 'Demo Intern',
      email: 'demo@example.com',
      password: 'DemoUser@123'
    });

    console.log(`Created demo user: ${demoUser.email} (ID: ${demoUser._id})`);

    await Transaction.deleteMany({ user: demoUser._id });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const getDate = (monthOffset, day) => {
      return new Date(currentYear, currentMonth + monthOffset, day);
    };

    const transactions = [
      { user: demoUser._id, type: 'income', amount: 50000, category: 'Salary', description: 'Monthly Salary', date: getDate(-2, 1) },
      { user: demoUser._id, type: 'expense', amount: 4000, category: 'Food', description: 'Groceries & Dining out', date: getDate(-2, 5) },
      { user: demoUser._id, type: 'expense', amount: 2000, category: 'Shopping', description: 'Clothes & Essentials', date: getDate(-2, 10) },
      { user: demoUser._id, type: 'expense', amount: 2500, category: 'Travel', description: 'Fuel & Cab fare', date: getDate(-2, 14) },
      { user: demoUser._id, type: 'expense', amount: 1800, category: 'Bills', description: 'Electricity & Internet', date: getDate(-2, 20) },

      { user: demoUser._id, type: 'income', amount: 50000, category: 'Salary', description: 'Monthly Salary', date: getDate(-1, 1) },
      { user: demoUser._id, type: 'expense', amount: 4200, category: 'Food', description: 'Groceries & Food delivery', date: getDate(-1, 4) },
      { user: demoUser._id, type: 'expense', amount: 2200, category: 'Shopping', description: 'Online purchases', date: getDate(-1, 12) },
      { user: demoUser._id, type: 'expense', amount: 2800, category: 'Travel', description: 'Public transport & Gas', date: getDate(-1, 18) },
      { user: demoUser._id, type: 'expense', amount: 1900, category: 'Bills', description: 'Utilities & Phone bill', date: getDate(-1, 24) },
      { user: demoUser._id, type: 'expense', amount: 600, category: 'Education', description: 'Online Course subscription', date: getDate(-1, 28) },

      { user: demoUser._id, type: 'income', amount: 50000, category: 'Salary', description: 'Monthly Salary', date: getDate(0, 1) },
      { user: demoUser._id, type: 'expense', amount: 2500, category: 'Food', description: 'Supermarket supplies', date: getDate(0, 2) },
      { user: demoUser._id, type: 'expense', amount: 3800, category: 'Shopping', description: 'New Electronics & Gadgets (Spike!)', date: getDate(0, 3) },
      { user: demoUser._id, type: 'expense', amount: 1500, category: 'Bills', description: 'High speed wifi bill', date: getDate(0, 4) },
      { user: demoUser._id, type: 'expense', amount: 1200, category: 'Travel', description: 'Train tickets', date: getDate(0, 5) }
    ];

    await Transaction.insertMany(transactions);
    console.log(`Successfully seeded ${transactions.length} transactions for Demo Intern!`);

    console.log('\n--- DEMO CREDENTIALS ---');
    console.log('Email:    demo@example.com');
    console.log('Password: DemoUser@123');
    console.log('------------------------\n');

    if (mongoServer) {
      await mongoServer.stop();
    } else {
      await mongoose.connection.close();
    }
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error.message);
    process.exit(1);
  }
};

seedData();
