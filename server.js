const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'your_secret_key_here';

app.use(cors());
app.use(bodyParser.json());

// Подключение к MongoDB
mongoose.connect('mongodb://localhost/multiuserdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Модель пользователя
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model('User', UserSchema);

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const candidate = await User.findOne({ email });
    if (candidate) return res.status(400).json({ message: 'Пользователь с таким email уже существует' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.json({ message: 'Регистрация прошла успешно' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Пользователь не найден' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Неверный пароль' });

    const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Middleware для проверки токена
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Нет токена' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Неверный токен' });
  }
}

// Личный кабинет (защищённый маршрут)
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'username email');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './Register';
import Login from './Login';
import Profile from './Profile';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const saveToken = (token) => {
    localStorage.setItem('token', token);
    setToken(token);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <BrowserRouter>
      <nav style={{ padding: 10, backgroundColor: '#eee' }}>
        {!token ? (
          <>
            <a href="/login" style={{ marginRight: 10 }}>Вход</a>
            <a href="/register">Регистрация</a>
          </>
        ) : (
          <>
            <a href="/profile" style={{ marginRight: 10 }}>Профиль</a>
            <button onClick={logout}>Выйти</button>
          </>
        )}
      </nav>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/profile" /> : <Navigate to="/login" />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login saveToken={saveToken} />} />
        <Route path="/profile" element={token ? <Profile token={token} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import React, { useState } from 'react';
import axios from 'axios';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('http://localhost:5000/api/register', form);
      setMessage(res.data.message);
      setForm({ username: '', email: '', password: '' });
    } catch (err) {
      setMessage(err.response?.data?.message || 'Ошибка регистрации');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '20px auto' }}>
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit}>
        <input name="username" placeholder="Имя пользователя" value={form.username} onChange={handleChange} required /><br /><br />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required /><br /><br />
        <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={handleChange} required /><br /><br />
        <button type="submit">Зарегистрироваться</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login({ saveToken }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('http://localhost:5000/api/login', form);
      saveToken(res.data.token);
      navigate('/profile');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Ошибка входа');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '20px auto' }}>
      <h2>Вход</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required /><br /><br />
        <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={handleChange} required /><br /><br />
        <button type="submit">Войти</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Profile({ token }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser(res.data))
      .catch(() => setError('Ошибка загрузки профиля'));
  }, [token]);

  if (error) return <p>{error}</p>;
  if (!user) return <p>Загрузка...</p>;

  return (
    <div style={{ maxWidth: 400, margin: '20px auto' }}>
      <h2>Личный кабинет</h2>
      <p><b>Имя:</b> {user.username}</p>
      <p><b>Email:</b> {user.email}</p>
    </div>
  );
}
