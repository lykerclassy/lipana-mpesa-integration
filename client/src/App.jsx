import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function App() {
  const [phone, setPhone] = useState('+254');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, waiting_pin, success, failed
  const [txnId, setTxnId] = useState(null);
  
  // Ref to manage the polling interval
  const pollInterval = useRef(null);

  const handlePayment = async (e) => {
    e.preventDefault();
    setStatus('processing');

    try {
      // 1. Trigger Stk Push
      const res = await axios.post('http://localhost:5000/api/pay', {
        phone,
        amount: Number(amount),
      });

      if (res.data.success) {
        setTxnId(res.data.transactionId);
        setStatus('waiting_pin');
      }
    } catch (err) {
      console.error(err);
      setStatus('failed');
    }
  };

  // 2. Real-time Polling Effect
  useEffect(() => {
    if (status === 'waiting_pin' && txnId) {
      
      // Start checking every 2 seconds
      pollInterval.current = setInterval(async () => {
        try {
          console.log("Checking status...");
          const res = await axios.get(`http://localhost:5000/api/status/${txnId}`);
          
          if (res.data.status === 'success') {
            setStatus('success');
            clearInterval(pollInterval.current); // Stop checking
          } else if (res.data.status === 'failed') {
            setStatus('failed');
            clearInterval(pollInterval.current); // Stop checking
          }
          // If 'pending', do nothing, loop runs again in 2s
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
    }

    // Cleanup interval when component unmounts
    return () => clearInterval(pollInterval.current);
  }, [status, txnId]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
      <div style={{ padding: '30px', border: '1px solid #ccc', borderRadius: '8px', width: '300px' }}>
        <h2>Lipana M-Pesa</h2>
        
        {status === 'success' ? (
           <div style={{ color: 'green', textAlign: 'center' }}>
             <h1>✅</h1>
             <h3>Payment Successful!</h3>
             <p>Thank you for your purchase.</p>
             <button onClick={() => window.location.reload()}>Pay Again</button>
           </div>
        ) : (
          <form onSubmit={handlePayment}>
            <div style={{ marginBottom: '15px' }}>
              <label>Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Amount</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>

            <button disabled={status === 'processing' || status === 'waiting_pin'} style={{ width: '100%', padding: '10px', background: '#000', color: '#fff' }}>
              {status === 'waiting_pin' ? 'Check your phone...' : 'Pay Now'}
            </button>
            
            {status === 'waiting_pin' && <p style={{fontSize: '0.8rem', color: 'blue'}}>Waiting for you to enter PIN...</p>}
            {status === 'failed' && <p style={{color: 'red'}}>Payment Failed or Cancelled.</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default App;