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
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [filters, setFilters] = useState({});

  // Users management state
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user',
    permissions: ['store', 'view']
  });

  // Form configuration state
  const [editFormConfig, setEditFormConfig] = useState(null);
  const [pdfTemplate, setPdfTemplate] = useState('');

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

  useEffect(() => {
    setFilteredRecords(applyFilters(records, filters));
  }, [records, filters]);

  const applyFilters = (recordsToFilter, activeFilters) => {
    return recordsToFilter.filter(record => {
      return Object.keys(activeFilters).every(key => {
        if (!activeFilters[key]) return true;
        const recordValue = record[key]?.toString().toLowerCase() || '';
        const filterValue = activeFilters[key].toLowerCase();
        return recordValue.includes(filterValue);
      });
    });
  };

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
        setEditFormConfig(config);
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
        setSuccess('PDF акт успешно создан');
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records/import/excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        loadAllRecords();
      } else {
        setError(data.detail || 'Ошибка при импорте данных');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  // Users management functions
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

  const clearMessages = () => {
    setError('');
    setSuccess('');
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
                  onClick={() => {setCurrentPage('store'); clearMessages();}}
                  className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Записать на хранение</h3>
                  <p className="text-green-100">Создать новую запись для хранения шин</p>
                </button>
              )}

              {hasPermission('release') && (
                <button
                  onClick={() => {setCurrentPage('release'); clearMessages();}}
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
                    clearMessages();
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
                    clearMessages();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Управление пользователями</h3>
                  <p className="text-purple-100">Создать и настроить пользователей</p>
                </button>
              )}

              {hasPermission('form_management') && (
                <button
                  onClick={() => {setCurrentPage('form-config'); clearMessages();}}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Изменение формы записи</h3>
                  <p className="text-indigo-100">Настроить поля формы записи</p>
                </button>
              )}

              {hasPermission('pdf_management') && (
                <button
                  onClick={() => {setCurrentPage('pdf-config'); clearMessages();}}
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
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">&times;</button>
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
              <div className="flex space-x-4">
                {user?.role === 'admin' && (
                  <>
                    <button
                      onClick={exportToExcel}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Экспорт в Excel
                    </button>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                      Импорт Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
                >
                  ← Назад
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Фильтр по ФИО"
                onChange={(e) => setFilters({...filters, full_name: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Фильтр по телефону"
                onChange={(e) => setFilters({...filters, phone: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Все статусы</option>
                <option value="Взята на хранение">Взята на хранение</option>
                <option value="Выдана с хранения">Выдана с хранения</option>
              </select>
              <select
                onChange={(e) => setFilters({...filters, storage_location: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Все места</option>
                <option value="Бекетова 3а.к15">Бекетова 3а.к15</option>
                <option value="Московское шоссе 22к1">Московское шоссе 22к1</option>
              </select>
            </div>

            {filteredRecords.length > 0 ? (
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
                    {filteredRecords.map((record) => (
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

        {/* Users Management */}
        {currentPage === 'users' && hasPermission('user_management') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Управление пользователями</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            {/* Create User Form */}
            <div className="mb-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Создать нового пользователя</h3>
              <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Логин</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Роль</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="user">Пользователь</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Права доступа</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['store', 'release', 'view', 'form_management', 'pdf_management', 'user_management'].map(permission => (
                      <label key={permission} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes(permission)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUser({...newUser, permissions: [...newUser.permissions, permission]});
                            } else {
                              setNewUser({...newUser, permissions: newUser.permissions.filter(p => p !== permission)});
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{
                          permission === 'store' ? 'Записывать' :
                          permission === 'release' ? 'Выдавать' :
                          permission === 'view' ? 'Просматривать' :
                          permission === 'form_management' ? 'Управлять формами' :
                          permission === 'pdf_management' ? 'Управлять PDF' :
                          permission === 'user_management' ? 'Управлять пользователями' : permission
                        }</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    {loading ? 'Создание...' : 'Создать пользователя'}
                  </button>
                </div>
              </form>
            </div>

            {/* Users List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Существующие пользователи</h3>
              {users.map((userItem) => (
                <div key={userItem.username} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{userItem.username}</h4>
                      <p className="text-sm text-gray-600">Роль: {userItem.role === 'admin' ? 'Администратор' : 'Пользователь'}</p>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Права:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {userItem.permissions.map(permission => (
                            <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {permission === 'store' ? 'Записывать' :
                               permission === 'release' ? 'Выдавать' :
                               permission === 'view' ? 'Просматривать' :
                               permission === 'form_management' ? 'Управлять формами' :
                               permission === 'pdf_management' ? 'Управлять PDF' :
                               permission === 'user_management' ? 'Управлять пользователями' : permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {userItem.username !== 'admin' && (
                      <button
                        onClick={() => deleteUser(userItem.username)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form Configuration */}
        {currentPage === 'form-config' && hasPermission('form_management') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Изменение формы записи</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Внимание:</strong> Поля "Уникальный номер", "Время создания", "Статус" и "Фамилия пользователя" нельзя отредактировать или удалить.
                При удалении поля оно удаляется и у существующих записей.
              </p>
            </div>

            {formConfig && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Текущие поля формы:</h3>
                
                {formConfig.fields.map((field, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Название поля</label>
                        <input
                          type="text"
                          value={field.name}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                          disabled
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Метка</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const newFields = [...formConfig.fields];
                            newFields[index].label = e.target.value;
                            setFormConfig({...formConfig, fields: newFields});
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const newFields = [...formConfig.fields];
                            newFields[index].type = e.target.value;
                            setFormConfig({...formConfig, fields: newFields});
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="text">Текст</option>
                          <option value="tel">Телефон</option>
                          <option value="email">Email</option>
                          <option value="select">Выбор</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Обязательное</label>
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) => {
                            const newFields = [...formConfig.fields];
                            newFields[index].required = e.target.checked;
                            setFormConfig({...formConfig, fields: newFields});
                          }}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    
                    {field.type === 'select' && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Варианты выбора (по одному на строку)</label>
                        <textarea
                          value={field.options ? field.options.join('\n') : ''}
                          onChange={(e) => {
                            const newFields = [...formConfig.fields];
                            newFields[index].options = e.target.value.split('\n').filter(o => o.trim());
                            setFormConfig({...formConfig, fields: newFields});
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          rows="3"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API_BASE_URL}/api/form-config`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({fields: formConfig.fields}),
                        });

                        if (response.ok) {
                          setSuccess('Конфигурация формы обновлена');
                          loadFormConfig();
                        } else {
                          setError('Ошибка при обновлении конфигурации');
                        }
                      } catch (err) {
                        setError('Ошибка подключения к серверу');
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Сохранить изменения
                  </button>
                  
                  <button
                    onClick={() => loadFormConfig()}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Отменить изменения
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF Template Configuration */}
        {currentPage === 'pdf-config' && hasPermission('pdf_management') && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Изменение формы Акта</h2>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
              >
                ← Назад
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm mb-2">
                <strong>Доступные переменные для подстановки:</strong>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700">
                <span>{'{''}full_name{'}'} - ФИО</span>
                <span>{'{''}phone{'}'} - Телефон</span>
                <span>{'{''}parameters{'}'} - Параметры</span>
                <span>{'{''}size{'}'} - Размер</span>
                <span>{'{''}storage_location{'}'} - Место хранения</span>
                <span>{'{''}record_number{'}'} - Номер акта</span>
                <span>{'{''}created_at{'}'} - Дата создания</span>
                <span>{'{''}car_brand{'}'} - Марка машины</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Шаблон PDF акта
                </label>
                <textarea
                  value={pdfTemplate}
                  onChange={(e) => setPdfTemplate(e.target.value)}
                  onFocus={async () => {
                    if (!pdfTemplate) {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API_BASE_URL}/api/pdf-template`, {
                          headers: {
                            'Authorization': `Bearer ${token}`,
                          },
                        });

                        if (response.ok) {
                          const data = await response.json();
                          setPdfTemplate(data.template);
                        }
                      } catch (err) {
                        setError('Ошибка загрузки шаблона');
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="8"
                  placeholder="Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}, номер акта {record_number} {created_at}. Подпись: _________________"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await fetch(`${API_BASE_URL}/api/pdf-template`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({template: pdfTemplate}),
                      });

                      if (response.ok) {
                        setSuccess('Шаблон PDF обновлен');
                      } else {
                        setError('Ошибка при обновлении шаблона');
                      }
                    } catch (err) {
                      setError('Ошибка подключения к серверу');
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Сохранить шаблон
                </button>
                
                <button
                  onClick={() => setPdfTemplate('')}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Сбросить к умолчанию
                </button>
              </div>

              {pdfTemplate && (
                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Предварительный просмотр:</h4>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">
                    {pdfTemplate.replace(/{(\w+)}/g, (match, key) => {
                      const examples = {
                        full_name: 'Иванов Иван Иванович',
                        phone: '+7-999-123-45-67',
                        parameters: '215/60/R16',
                        size: '4 шт',
                        storage_location: 'Бекетова 3а.к15',
                        record_number: '123',
                        created_at: new Date().toLocaleDateString('ru-RU'),
                        car_brand: 'Toyota Camry'
                      };
                      return examples[key] || match;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;