import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [formConfig, setFormConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form state
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // Storage form state
  const [storageData, setStorageData] = useState({
    full_name: '',
    phone: '',
    phone_additional: '',
    car_brand: '',
    parameters: '',
    size: '',
    storage_location: ''
  });

  // Search state
  const [searchData, setSearchData] = useState({
    query: '',
    searchType: 'record_number'
  });
  const [searchResults, setSearchResults] = useState([]);

  // Records state
  const [records, setRecords] = useState([]);
  const [createdRecord, setCreatedRecord] = useState(null);

  // Users management state
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user',
    permissions: ['store', 'view']
  });

  // PDF and Excel functions
  const generatePDF = async (recordId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records/${recordId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `act_${recordId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Ошибка при генерации PDF');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records/export/excel`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storage_records_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess('Данные успешно экспортированы');
      } else {
        setError('Ошибка при экспорте данных');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        setError('Ошибка загрузки пользователей');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        setSuccess('Пользователь успешно создан');
        setNewUser({
          username: '',
          password: '',
          role: 'user',
          permissions: ['store', 'view']
        });
        loadUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка при создании пользователя');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const updateUserPermissions = async (username, permissions) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/${username}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions }),
      });

      if (response.ok) {
        setSuccess('Права пользователя обновлены');
        loadUsers();
      } else {
        setError('Ошибка при обновлении прав');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const deleteUser = async (username) => {
    if (window.confirm(`Вы уверены, что хотите удалить пользователя ${username}?`)) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/users/${username}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setSuccess('Пользователь удален');
          loadUsers();
        } else {
          setError('Ошибка при удалении пользователя');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу');
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
      setCurrentPage('dashboard');
      loadFormConfig();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setUser(data.user);
        setCurrentPage('dashboard');
        await loadFormConfig();
      } else {
        setError(data.detail || 'Ошибка входа');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const loadFormConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/form-config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const config = await response.json();
        setFormConfig(config);
      }
    } catch (err) {
      console.error('Error loading form config:', err);
    }
  };

  const handleStorageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(storageData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Запись успешно создана!');
        setCreatedRecord(data.record);
        setStorageData({
          full_name: '',
          phone: '',
          phone_additional: '',
          car_brand: '',
          parameters: '',
          size: '',
          storage_location: ''
        });
      } else {
        setError(data.detail || 'Ошибка при создании записи');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/storage-records/search?query=${encodeURIComponent(searchData.query)}&search_type=${searchData.searchType}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.records);
      } else {
        setError(data.detail || 'Ошибка поиска');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (recordId) => {
    if (window.confirm('Вы уверены, что хотите выдать клиенту? Забрали ли вы акт?')) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/storage-records/${recordId}/release`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess('Запись успешно выдана с хранения');
          // Refresh search results
          handleSearch({ preventDefault: () => {} });
        } else {
          setError(data.detail || 'Ошибка при выдаче');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу');
      } finally {
        setLoading(false);
      }
    }
  };

  const loadAllRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setRecords(data.records);
      } else {
        setError(data.detail || 'Ошибка загрузки записей');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentPage('login');
  };

  const hasPermission = (permission) => {
    return user && user.permissions.includes(permission);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Шинное Бюро</h1>
            <p className="text-gray-600">Система управления хранением</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Логин
              </label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p><strong>Тестовые данные:</strong></p>
            <p>Admin: admin / K2enlzuzz2</p>
            <p>User: user / user</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Шинное Бюро</h1>
              <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Привет, {user?.username}!</span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        {currentPage === 'dashboard' && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Панель управления</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hasPermission('store') && (
                <button
                  onClick={() => setCurrentPage('store')}
                  className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Записать на хранение</h3>
                  <p className="text-green-100">Создать новую запись для хранения шин</p>
                </button>
              )}

              {hasPermission('release') && (
                <button
                  onClick={() => setCurrentPage('release')}
                  className="bg-orange-600 hover:bg-orange-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Выдать с хранения</h3>
                  <p className="text-orange-100">Найти и выдать шины клиенту</p>
                </button>
              )}

              {hasPermission('view') && (
                <button
                  onClick={() => {
                    setCurrentPage('records');
                    loadAllRecords();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Просмотр записей</h3>
                  <p className="text-blue-100">Посмотреть все сделанные записи</p>
                </button>
              )}

              {hasPermission('user_management') && (
                <button
                  onClick={() => {
                    setCurrentPage('users');
                    loadUsers();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Управление пользователями</h3>
                  <p className="text-purple-100">Создать и настроить пользователей</p>
                </button>
              )}

              {hasPermission('form_management') && (
                <button
                  onClick={() => setCurrentPage('form-config')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Изменение формы записи</h3>
                  <p className="text-indigo-100">Настроить поля формы записи</p>
                </button>
              )}

              {hasPermission('pdf_management') && (
                <button
                  onClick={() => setCurrentPage('pdf-config')}
                  className="bg-teal-600 hover:bg-teal-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Изменение формы Акта</h3>
                  <p className="text-teal-100">Настроить шаблон PDF акта</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Storage Form */}
        {currentPage === 'store' && hasPermission('store') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Записать на хранение</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            {createdRecord && (
              <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-4">Запись успешно создана!</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Уникальный номер:</strong> {createdRecord.record_number}</p>
                  <p><strong>ID записи:</strong> {createdRecord.record_id}</p>
                  <p><strong>Статус:</strong> {createdRecord.status}</p>
                  <p><strong>Время создания:</strong> {new Date(createdRecord.created_at).toLocaleString('ru-RU')}</p>
                  <p><strong>Создал:</strong> {createdRecord.created_by}</p>
                </div>
                <div className="mt-4 flex space-x-4">
                  <button
                    onClick={() => generatePDF(createdRecord.record_id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Распечатать акт
                  </button>
                  <button
                    onClick={() => setCreatedRecord(null)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Создать новую запись
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleStorageSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО *
                </label>
                <input
                  type="text"
                  value={storageData.full_name}
                  onChange={(e) => setStorageData({...storageData, full_name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Номер телефона *
                </label>
                <input
                  type="tel"
                  value={storageData.phone}
                  onChange={(e) => setStorageData({...storageData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Доп номер телефона
                </label>
                <input
                  type="tel"
                  value={storageData.phone_additional}
                  onChange={(e) => setStorageData({...storageData, phone_additional: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Марка машины *
                </label>
                <input
                  type="text"
                  value={storageData.car_brand}
                  onChange={(e) => setStorageData({...storageData, car_brand: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Параметры *
                </label>
                <input
                  type="text"
                  value={storageData.parameters}
                  onChange={(e) => setStorageData({...storageData, parameters: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Например: 215/60/R16"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Размер *
                </label>
                <input
                  type="text"
                  value={storageData.size}
                  onChange={(e) => setStorageData({...storageData, size: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Например: 4 шт."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Место хранения *
                </label>
                <select
                  value={storageData.storage_location}
                  onChange={(e) => setStorageData({...storageData, storage_location: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Выберите место хранения</option>
                  <option value="Бекетова 3а.к15">Бекетова 3а.к15</option>
                  <option value="Московское шоссе 22к1">Московское шоссе 22к1</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Создание записи...' : 'Записать на хранение'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Release Form */}
        {currentPage === 'release' && hasPermission('release') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Выдать с хранения</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            <form onSubmit={handleSearch} className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тип поиска
                  </label>
                  <select
                    value={searchData.searchType}
                    onChange={(e) => setSearchData({...searchData, searchType: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="record_number">Уникальный номер</option>
                    <option value="full_name">ФИО</option>
                    <option value="phone">Номер телефона</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Поисковый запрос
                  </label>
                  <input
                    type="text"
                    value={searchData.query}
                    onChange={(e) => setSearchData({...searchData, query: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Введите значение для поиска"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
                  >
                    {loading ? 'Поиск...' : 'Найти'}
                  </button>
                </div>
              </div>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Результаты поиска:</h3>
                {searchResults.map((record) => (
                  <div key={record.record_id} className="bg-gray-50 p-6 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p><strong>Номер:</strong> {record.record_number}</p>
                        <p><strong>ФИО:</strong> {record.full_name}</p>
                        <p><strong>Телефон:</strong> {record.phone}</p>
                        <p><strong>Машина:</strong> {record.car_brand}</p>
                      </div>
                      <div>
                        <p><strong>Параметры:</strong> {record.parameters}</p>
                        <p><strong>Размер:</strong> {record.size}</p>
                        <p><strong>Место:</strong> {record.storage_location}</p>
                        <p><strong>Статус:</strong> {record.status}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <p>Создано: {new Date(record.created_at).toLocaleString('ru-RU')}</p>
                        <p>Создал: {record.created_by}</p>
                      </div>
                      <button
                        onClick={() => handleRelease(record.record_id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                      >
                        Выдать с хранения
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchData.query && !loading && (
              <div className="text-center py-8 text-gray-500">
                Записи не найдены
              </div>
            )}
          </div>
        )}

        {/* Records View */}
        {currentPage === 'records' && hasPermission('view') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Просмотр записей</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            {records.length > 0 ? (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Записи ({records.length})</h3>
                  {user?.role === 'admin' && (
                    <button
                      onClick={exportToExcel}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Экспорт в Excel
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">№</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Телефон</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Машина</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Параметры</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Размер</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Место</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.record_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.record_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.car_brand}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.parameters}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.size}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.storage_location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'Взята на хранение' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.created_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {loading ? 'Загрузка записей...' : 'Записи отсутствуют'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;