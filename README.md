# lipana-mpesa-integration
This is fantastic news\! You now have a robust, production-ready M-Pesa integration.

Below are three things:

1.  **The "Master Documentation/Prompt"**: Save this text file. You can paste it into an AI in the future or give it to a developer, and it will recreate this exact working system without the errors we faced.
2.  **`README.md`**: A professional readme for your GitHub repo.
3.  **`.gitignore`**: To keep your project clean and secure.

-----

### 1\. The Master Integration Guide (Save this for the future)

**Title:** M-Pesa Integration Guide (Lipana API with Real-Time Status)
**Tech Stack:** Node.js, Express, MongoDB, React (MERN)

#### **1. Architecture Overview**

  * **Initiate:** Frontend sends Phone/Amount -\> Backend -\> Lipana SDK -\> Safaricom.
  * **Process:** User enters PIN on mobile.
  * **Callback:** Safaricom -\> Lipana -\> Backend Webhook (Updates DB status).
  * **Feedback:** Frontend polls Backend every 2s until status is "Success".

#### **2. Backend Implementation (Node.js)**

*Requires: `@lipana/sdk`, `express`, `mongoose`, `cors`, `dotenv`*

**Key Logic (Avoids common SDK bugs):**

1.  **STK Push:** The SDK returns the `transactionId` at the root level, NOT inside `.data`.
2.  **Webhook:** Lipana sends payload with `transaction_id` (snake\_case) or `transactionId` (camelCase). The code must check both.

**The "Golden" Backend Code:**

```javascript
// ... Imports ...

// WEBHOOK HANDLER (Universal Fix)
app.post('/api/webhook', async (req, res) => {
    const body = req.body;
    const payload = body.data || body; 
    // Checks both nested and flat structures
    const txnId = payload.transactionId || payload.transaction_id;

    if (!txnId) return res.send('OK');

    if (body.event === 'transaction.success') {
        await Transaction.findOneAndUpdate(
            { transactionId: txnId },
            { status: 'success' }
        );
    } 
    // ... Handle failure events ...
    res.send('OK');
});

// STATUS CHECK (For Polling)
app.get('/api/status/:id', async (req, res) => {
    const txn = await Transaction.findOne({ transactionId: req.params.id });
    res.json({ status: txn ? txn.status : 'unknown' });
});
```

#### **3. Frontend Implementation (React)**

*Requires: `axios`*

**Polling Logic:**

1.  On "Pay" click -\> Call `/api/pay` -\> Save `transactionId` in state.
2.  Use `setInterval` inside `useEffect`.
3.  Hit `/api/status/:id` every 2 seconds.
4.  If status `success`, clear interval and show success screen.

-----

### 2\. README.md (For your GitHub)

Create a file named `README.md` in your root folder and paste this:

````markdown
# M-Pesa Payment Integration (MERN Stack)

A full-stack implementation of M-Pesa payments using the **Lipana API**. This project demonstrates how to initiate an STK Push, handle Webhook callbacks securely, and provide real-time payment status updates to the frontend.

## 🚀 Features

-   **STK Push Initiation:** Trigger M-Pesa PIN prompts on user phones.
-   **Robust Webhook Handling:** Handles various payload structures (snake_case vs camelCase) to ensure database updates never fail.
-   **Real-Time Feedback:** Frontend polls the server to instantly confirm payment success without page reloads.
-   **MongoDB Integration:** Logs all transaction requests and statuses.

## 🛠 Tech Stack

-   **Frontend:** React.js, Vite
-   **Backend:** Node.js, Express.js
-   **Database:** MongoDB
-   **Payment Gateway:** Lipana (M-Pesa wrapper)

## 📂 Project Structure

```text
/
├── client/         # React Frontend application
├── server/         # Node.js API and Webhook handler
└── README.md
````

## ⚙️ Setup & Installation

### 1\. Clone the Repository

```bash
git clone [https://github.com/your-username/lipana-mpesa-integration.git](https://github.com/your-username/lipana-mpesa-integration.git)
cd lipana-mpesa-integration
```

### 2\. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server` folder:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/mpesa_db
LIPANA_SECRET_KEY=lip_sk_live_YOUR_KEY_HERE
```

Run the server:

```bash
node index.js
```

### 3\. Frontend Setup

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

## 🧪 How to Test (Localhost)

Since M-Pesa callbacks (Webhooks) need a public URL, `localhost` won't work alone.

1.  **Start Ngrok:** Expose your backend port.
    ```bash
    ngrok http 5000
    ```
2.  **Configure Lipana:** Copy the HTTPS URL from Ngrok (e.g., `https://xyz.ngrok-free.app`) and paste it into your Lipana Dashboard Webhook settings:
    `https://xyz.ngrok-free.app/api/webhook`
3.  **Pay:** Open the React app, enter a phone number (`+254...`), and pay.

## 📝 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/pay` | Initiates STK Push. Expects `{ phone, amount }` |
| `POST` | `/api/webhook` | Receives status updates from Lipana |
| `GET` | `/api/status/:id` | Checks DB status for a specific Transaction ID |

````

---

### 3. .gitignore (Crucial for Security)

Create a file named `.gitignore` in your **ROOT** folder (or one in each subfolder if you prefer). This prevents you from accidentally uploading your keys or massive node_modules folders.

```text
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment Variables (IMPORTANT: Never push keys!)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build Outputs
dist/
build/
out/

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
logs
*.log

# OS System Files
.DS_Store
Thumbs.db

# IDE Files
.vscode/
.idea/
````

### Final Step

Now you can initialize git and push safely:

```bash
git init
git add .
git commit -m "Initial commit: Working M-Pesa integration with Webhooks"
# git remote add origin ...
# git push -u origin main
```