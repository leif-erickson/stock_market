// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PortfolioItem from './components/PortfolioItem';

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('stock');
  const [quantity, setQuantity] = useState(0);
  const [originalCost, setOriginalCost] = useState(0);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    const response = await axios.get('http://localhost:5000/portfolio');
    setPortfolio(response.data);
  };

  const addItem = async () => {
    await axios.post('http://localhost:5000/portfolio', { symbol, type, quantity: parseFloat(quantity), original_cost: parseFloat(originalCost) });
    fetchPortfolio();
    setSymbol('');
    setQuantity(0);
    setOriginalCost(0);
  };

  const removeItem = async (id) => {
    await axios.delete(`http://localhost:5000/portfolio/${id}`);
    fetchPortfolio();
  };

  return (
    <div>
      <h1>Portfolio Tracker</h1>
      <div>
        <input placeholder="Symbol (e.g., AAPL or BTC)" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
        </select>
        <input type="number" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <input type="number" placeholder="Original Cost per Unit" value={originalCost} onChange={(e) => setOriginalCost(e.target.value)} />
        <button onClick={addItem}>Add</button>
      </div>
      <ul>
        {portfolio.map(item => (
          <PortfolioItem key={item.id} item={item} onRemove={removeItem} />
        ))}
      </ul>
    </div>
  );
}

export default App;