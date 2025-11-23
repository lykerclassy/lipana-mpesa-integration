require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Lipana } = require('@lipana/sdk');

const app = express();

// ==========================================
// 1. CONFIGURATION & MIDDLEWARE
// ==========================================
app.use(cors());

// We need to handle JSON payloads. 
// The 'verify' function captures the raw body in case you need to verify 
// Webhook signatures later (security best practice).
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Initialize Lipana SDK
const lipana = new Lipana({
    apiKey: process.env.LIPANA_SECRET_KEY,
    environment: 'production' // Switch to 'sandbox' if using test keys
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Define Database Schema
const TransactionSchema = new mongoose.Schema({
    phone: String,
    amount: Number,
    transactionId: String,
    status: { type: String, default: 'pending' }, // pending, success, failed
    lipanaReference: String,
    timestamp: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);


// ==========================================
// 2. ROUTE: INITIATE PAYMENT (STK PUSH)
// ==========================================
app.post('/api/pay', async (req, res) => {
    const { phone, amount } = req.body;
    console.log(`👉 Initiating payment: ${phone} for KES ${amount}`);

    try {
        // Call Lipana API
        const result = await lipana.transactions.initiateStkPush({
            phone: phone,
            amount: amount
        });

        // DEBUG: Print response to terminal
        console.log("📡 Lipana Response:", JSON.stringify(result, null, 2));

        // FIX 1: Check result.transactionId directly (removed .data wrapper)
        if (!result || !result.transactionId) {
            console.error("❌ Lipana returned an error or empty data.");
            return res.status(400).json({ 
                success: false, 
                error: result.message || "Failed to initiate payment." 
            });
        }

        // Save to Database
        const newTxn = new Transaction({
            phone,
            amount,
            transactionId: result.transactionId, // FIX: Direct access
            status: 'pending'
        });
        await newTxn.save();

        console.log("✅ Transaction saved to DB:", result.transactionId);

        // Send success to Frontend
        res.json({ 
            success: true, 
            transactionId: result.transactionId 
        });

    } catch (error) {
        console.error("❌ CRITICAL ERROR:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Internal Server Error" 
        });
    }
});


// ==========================================
// 3. ROUTE: WEBHOOK (RECEIVE UPDATE)
// ==========================================
app.post('/api/webhook', async (req, res) => {
    try {
        console.log("📥 Raw Webhook:", JSON.stringify(req.body, null, 2));

        const body = req.body;
        const event = body.event;

        // FIX 2: ROBUST ID FINDER
        // Handles { transaction_id: ... } (snake_case) AND { data: { transactionId: ... } } (nested)
        const payload = body.data || body; 
        const txnId = payload.transactionId || payload.transaction_id;

        if (!txnId) {
            console.log("⚠️ Webhook received but could not find a Transaction ID. Ignoring.");
            return res.status(200).send('OK');
        }

        console.log(`🔍 Processing Update for: ${txnId}`);

        // Handle Success
        if (event === 'payment.success' || event === 'transaction.success') {
            const updated = await Transaction.findOneAndUpdate(
                { transactionId: txnId },
                { status: 'success', lipanaReference: payload.reference || payload.checkoutRequestID },
                { new: true }
            );
            
            if (updated) {
                console.log(`✅ DB Updated to SUCCESS: ${txnId}`);
            } else {
                console.log(`⚠️ DB Update Failed: Could not find transaction ${txnId} in database.`);
            }
        } 
        // Handle Failure
        else if (event === 'payment.failed' || event === 'transaction.failed' || event === 'transaction.timeout') {
            await Transaction.findOneAndUpdate(
                { transactionId: txnId },
                { status: 'failed' }
            );
            console.log(`❌ DB Updated to FAILED: ${txnId}`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error("Webhook Internal Error:", err);
        res.status(500).send('Webhook Error');
    }
});


// ==========================================
// 4. ROUTE: CHECK STATUS (POLLING)
// ==========================================
app.get('/api/status/:id', async (req, res) => {
    try {
        const txn = await Transaction.findOne({ transactionId: req.params.id });
        
        if (!txn) {
            return res.status(404).json({ status: 'unknown', message: 'Transaction not found' });
        }
        
        res.json({ status: txn.status });
    } catch (err) {
        console.error("Status Check Error:", err);
        res.status(500).json({ error: 'Database error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));