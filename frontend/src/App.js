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
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [pdfTemplateLoaded, setPdfTemplateLoaded] = useState(false);
  
  // Record detail state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  
  // Bulk operations state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState(new Set());

  // Calculator state
  const [calculatorSettings, setCalculatorSettings] = useState({});
  const [selectedVehicleType, setSelectedVehicleType] = useState('passenger');
  const [selectedTireSize, setSelectedTireSize] = useState('R16');
  const [wheelCount, setWheelCount] = useState(4);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculatorResult, setCalculatorResult] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({});

  // Check if current path is a public calculator route
  const isCalculatorRoute = window.location.pathname.startsWith('/calculator');

  // Function to sort records
  const sortRecords = (recordsToSort, key, direction) => {
    return [...recordsToSort].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      // Handle numbers
      if (key === 'record_number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle dates
      if (key === 'created_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle text - Russian first, then English
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        
        const aIsRussian = /[а-я]/.test(aVal);
        const bIsRussian = /[а-я]/.test(bVal);
        
        if (aIsRussian && !bIsRussian) return direction === 'asc' ? -1 : 1;
        if (!aIsRussian && bIsRussian) return direction === 'asc' ? 1 : -1;
        
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return 0;
    });
  };

  // Calculator functions
  const loadCalculatorSettings = async (vehicleType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calculator/settings/${vehicleType}`);
      
      if (response.ok) {
        const data = await response.json();
        setCalculatorSettings(prev => ({...prev, [vehicleType]: data}));
      } else {
        setError('Ошибка загрузки настроек калькулятора');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const calculateCost = async () => {
    try {
      const requestData = {
        vehicle_type: selectedVehicleType,
        tire_size: selectedTireSize,
        wheel_count: wheelCount,
        selected_services: selectedServices,
        additional_options: selectedOptions
      };

      const response = await fetch(`${API_BASE_URL}/api/calculator/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        setCalculationResult(result);
      } else {
        setError('Ошибка расчета стоимости');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const saveCalculationResult = async () => {
    try {
      const requestData = {
        vehicle_type: selectedVehicleType,
        tire_size: selectedTireSize,
        wheel_count: wheelCount,
        selected_services: selectedServices,
        additional_options: selectedOptions
      };

      const response = await fetch(`${API_BASE_URL}/api/calculator/save-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        const link = `${window.location.origin}/calculator/result/${result.unique_id}`;
        
        // Copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(link);
          setSuccess('Ссылка скопирована в буфер обмена!');
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = link;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setSuccess('Ссылка скопирована в буфер обмена!');
        }
        
        return result.unique_id;
      } else {
        setError('Ошибка сохранения результата');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const toggleService = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const toggleOption = (optionId) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      } else {
        return [...prev, optionId];
      }
    });
  };

  const showServiceInfo = (title, description) => {
    setInfoModalContent({ title, description });
    setShowInfoModal(true);
  };

  const loadCalculatorResult = async (uniqueId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calculator/result/${uniqueId}`);
      
      if (response.ok) {
        const result = await response.json();
        setCalculatorResult(result);
      } else {
        setError('Результат не найден');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  // Handle sort click
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setFilteredRecords(sortRecords(filteredRecords, key, direction));
  };

  // Delete record function
  const deleteRecord = async (recordId) => {
    if (window.confirm('Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/storage-records/${recordId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setSuccess('Запись удалена');
          loadAllRecords();
        } else {
          setError('Ошибка при удалении записи');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу');
      }
    }
  };

  useEffect(() => {
    // Load calculator settings for both vehicle types
    loadCalculatorSettings('passenger');
    loadCalculatorSettings('truck');
    
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    // Check if URL contains calculator routes (public access)
    const path = window.location.pathname;
    console.log("Current path:", path);
    console.log("Is calculator path:", path.startsWith('/calculator'));
    
    if (path.startsWith('/calculator')) {
      console.log("Setting calculator page");
      if (path === '/calculator') {
        setCurrentPage('public-calculator');
      } else if (path.includes('/result/')) {
        const resultId = path.split('/result/')[1];
        setCurrentPage('calculator-result');
        // Load result data
        setTimeout(() => {
          loadCalculatorResult(resultId);
        }, 100);
      }
      return; // Skip authentication check for calculator pages
    }
    
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

  useEffect(() => {
    // Load PDF template when user navigates to PDF config page
    if (currentPage === 'pdf-config' && !pdfTemplateLoaded) {
      loadPdfTemplate();
    }
    
    // Load calculator settings when user navigates to calculator page
    if (currentPage === 'public-calculator') {
      loadCalculatorSettings('passenger');
    }
  }, [currentPage, pdfTemplateLoaded]);

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

  const loadPdfTemplate = async () => {
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
        setPdfTemplateLoaded(true);
        setSuccess('Шаблон загружен из базы данных');
      } else {
        setError('Ошибка при загрузке шаблона');
      }
    } catch (err) {
      console.error('Error loading PDF template:', err);
      setError('Ошибка подключения к серверу при загрузке шаблона');
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

  // Bulk operations functions
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedRecords(new Set());
  };

  const toggleRecordSelection = (recordId) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.size === 0) {
      setError('Выберите записи для удаления');
      return;
    }

    if (window.confirm(`Вы уверены, что хотите удалить ${selectedRecords.size} записей? Это действие необратимо.`)) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/storage-records/bulk`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([...selectedRecords]),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(`Удалено ${data.deleted_count} записей`);
          setBulkMode(false);
          setSelectedRecords(new Set());
          loadAllRecords(); // Refresh the list
        } else {
          setError(data.detail || 'Ошибка при удалении записей');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу');
      } finally {
        setLoading(false);
      }
    }
  };



  // Drag and drop functions for form fields
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newFields = [...formConfig.fields];
    const draggedItem = newFields[draggedIndex];
    
    // Remove dragged item
    newFields.splice(draggedIndex, 1);
    
    // Insert at new position
    newFields.splice(dropIndex, 0, draggedItem);
    
    setFormConfig({
      ...formConfig,
      fields: newFields
    });
    
    setDraggedIndex(null);
  };

  // Load record details
  const loadRecordDetail = async (recordId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/storage-records/${recordId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedRecord(data.record);
        setShowRecordDetail(true);
      } else {
        setError('Ошибка загрузки записи');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  // Handle taking to storage (for "Новая" status)
  const handleTakeToStorage = async (recordId) => {
    if (window.confirm('Взять запись на хранение?')) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/storage-records/${recordId}/take-storage`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess('Запись взята на хранение');
          handleSearch({ preventDefault: () => {} });
        } else {
          setError(data.detail || 'Ошибка при взятии на хранение');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу');
      } finally {
        setLoading(false);
      }
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



  // Auto-calculate when selections change
  useEffect(() => {
    if (selectedServices.length > 0 && calculatorSettings[selectedVehicleType]) {
      calculateCost();
    }
  }, [selectedVehicleType, selectedTireSize, wheelCount, selectedServices, selectedOptions]);

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

  // Check if current path is a public calculator route
  const isPublicCalculatorRoute = () => {
    const path = window.location.pathname;
    console.log("isPublicCalculatorRoute called, path:", path);
    console.log("Result:", path.startsWith('/calculator'));
    return path.startsWith('/calculator');
  };

  // Check if this is a calculator route on initial load
  const currentPath = window.location.pathname;
  const isCalculatorPath = currentPath.startsWith('/calculator');

  // If it's a public calculator route, render calculator without authentication
  if (!isAuthenticated && isCalculatorPath) {
      console.log("Rendering calculator without authentication");
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Калькулятор Шиномонтажа</h1>
                <p className="text-gray-600 mb-8">Рассчитайте стоимость услуг шиномонтажа онлайн</p>
                
                {/* Vehicle Type Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Тип транспорта</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => {
                        setSelectedVehicleType('passenger');
                        loadCalculatorSettings('passenger');
                      }}
                      className={`px-6 py-3 rounded-lg font-medium ${
                        selectedVehicleType === 'passenger'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Легковой автомобиль
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVehicleType('truck');
                        loadCalculatorSettings('truck');
                      }}
                      className={`px-6 py-3 rounded-lg font-medium ${
                        selectedVehicleType === 'truck'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Грузовой автомобиль
                    </button>
                  </div>
                </div>

                {calculatorSettings[selectedVehicleType] && (
                  <>
                    {/* Tire Size Selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Размер шин</label>
                      <select
                        value={selectedTireSize}
                        onChange={(e) => setSelectedTireSize(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Object.keys(calculatorSettings[selectedVehicleType].services[0]?.time_by_size || {}).map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>

                    {/* Wheel Count */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Количество колес</label>
                      <div className="flex space-x-4">
                        {[1, 2, 4].map(count => (
                          <button
                            key={count}
                            onClick={() => setWheelCount(count)}
                            className={`px-4 py-2 rounded-lg font-medium ${
                              wheelCount === count
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {count} {count === 1 ? 'колесо' : count === 2 ? 'колеса' : 'колеса'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Services Selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Услуги</label>
                      <div className="space-y-3">
                        {calculatorSettings[selectedVehicleType].services.map(service => (
                          <div key={service.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={service.id}
                                checked={selectedServices.includes(service.id)}
                                onChange={() => toggleService(service.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="ml-3">
                                <label htmlFor={service.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                  {service.name}
                                </label>
                                <p className="text-sm text-gray-500">{service.time_by_size[selectedTireSize] || 0} мин/колесо</p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <button
                                onClick={() => showServiceInfo(service.name, service.description)}
                                className="text-blue-600 hover:text-blue-800 ml-2"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Additional Options */}
                    {calculatorSettings[selectedVehicleType].additional_options.length > 0 && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Дополнительные опции</label>
                        <div className="space-y-3">
                          {calculatorSettings[selectedVehicleType].additional_options.map(option => (
                            <div key={option.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={option.id}
                                  checked={selectedOptions.includes(option.id)}
                                  onChange={() => toggleOption(option.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="ml-3">
                                  <label htmlFor={option.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                    {option.name}
                                  </label>
                                  <p className="text-sm text-gray-500">×{option.time_multiplier}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => showInfoModal(option.name, option.description)}
                                className="text-blue-600 hover:text-blue-800 ml-2"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Results */}
                    {calculationResult && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-medium text-blue-900 mb-4">Результат расчета</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-blue-700">Общее время:</p>
                            <p className="text-xl font-bold text-blue-900">{calculationResult.total_time} минут</p>
                          </div>
                          <div>
                            <p className="text-sm text-blue-700">Общая стоимость:</p>
                            <p className="text-xl font-bold text-blue-900">{calculationResult.total_cost} рублей</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={saveCalculationResult}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                          Сохранить и получить ссылку
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // If not authenticated and not calculator path, show login form
    if (!isAuthenticated) {
      return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Хранение Шин</h1>
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

            {/* Calculator Test Button */}
            <button
              type="button"
              onClick={() => setCurrentPage('public-calculator')}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Тест калькулятора (публичный доступ)
            </button>
          </form>
        </div>
      </div>
    );


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Хранение Шин</h1>
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

              {hasPermission('calculator_management') && (
                <button
                  onClick={() => {setCurrentPage('calculator-admin'); clearMessages();}}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Управление калькулятором</h3>
                  <p className="text-purple-100">Настроить услуги и цены калькулятора</p>
                </button>
              )}

              <div className="bg-gray-100 p-6 rounded-xl">
                <h3 className="text-xl font-semibold mb-2">Публичный калькулятор</h3>
                <p className="text-gray-600 mb-4">Ссылка для клиентов</p>
                <button
                  onClick={() => window.open('/calculator', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Открыть калькулятор
                </button>
              </div>

              {hasPermission('calculator_management') && (
                <button
                  onClick={() => {setCurrentPage('calculator-admin'); clearMessages();}}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl shadow-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">Управление калькулятором</h3>
                  <p className="text-purple-100">Настроить услуги и цены калькулятора</p>
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
              {formConfig && formConfig.fields && formConfig.fields.map((field) => (
                <div key={field.name} className={field.type === 'select' || field.name === 'parameters' ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label} {field.required && '*'}
                  </label>
                  
                  {field.type === 'select' ? (
                    <select
                      value={storageData[field.name] || ''}
                      onChange={(e) => setStorageData({...storageData, [field.name]: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={field.required}
                    >
                      <option value="">Выберите {field.label.toLowerCase()}</option>
                      {field.options && field.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                      value={storageData[field.name] || ''}
                      onChange={(e) => {
                        let value = e.target.value;
                        // Ограничение для телефона - не более 14 символов
                        if (field.name === 'phone' || field.name === 'phone_additional') {
                          value = value.slice(0, 14);
                        }
                        setStorageData({...storageData, [field.name]: value});
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Введите ${field.label.toLowerCase()}`}
                      required={field.required}
                      maxLength={field.name === 'phone' || field.name === 'phone_additional' ? 14 : undefined}
                    />
                  )}
                </div>
              ))}

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
                        {record.retail_status_text && (
                          <p>Статус в Retail: <span className="font-medium">{record.retail_status_text}</span></p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {record.status === 'Новая' && (
                          <button
                            onClick={() => handleTakeToStorage(record.record_id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                          >
                            Взять на хранение
                          </button>
                        )}
                        {record.status === 'Взята на хранение' && (
                          <button
                            onClick={() => handleRelease(record.record_id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                          >
                            Выдать с хранения
                          </button>
                        )}
                      </div>
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
                {hasPermission('delete_records') && (
                  <button
                    onClick={toggleBulkMode}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      bulkMode 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {bulkMode ? 'Отмена' : 'Массовые действия'}
                  </button>
                )}
                {bulkMode && selectedRecords.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Удалить выбранные ({selectedRecords.size})
                  </button>
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
              <div className="space-y-4">
                {/* Верхний скролл бар */}
                <div className="overflow-x-auto">
                  <div className="h-4 min-w-full"></div>
                </div>
                
                {/* Основная таблица */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {bulkMode && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecords(new Set(filteredRecords.map(r => r.record_id)));
                              } else {
                                setSelectedRecords(new Set());
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </th>
                      )}
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('record_number')}
                      >
                        № {sortConfig.key === 'record_number' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('full_name')}
                      >
                        ФИО {sortConfig.key === 'full_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('phone')}
                      >
                        Телефон {sortConfig.key === 'phone' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('car_brand')}
                      >
                        Машина {sortConfig.key === 'car_brand' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('parameters')}
                      >
                        Параметры {sortConfig.key === 'parameters' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('size')}
                      >
                        Размер {sortConfig.key === 'size' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('storage_location')}
                      >
                        Место {sortConfig.key === 'storage_location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        Статус {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('created_at')}
                      >
                        Дата {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      {hasPermission('delete_records') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.map((record) => (
                      <tr key={record.record_id} className="hover:bg-gray-50">
                        {bulkMode && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedRecords.has(record.record_id)}
                              onChange={() => toggleRecordSelection(record.record_id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button
                            onClick={() => loadRecordDetail(record.record_id)}
                            className="text-blue-600 hover:text-blue-900 underline"
                          >
                            {record.record_number}
                          </button>
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
                        {hasPermission('delete_records') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => deleteRecord(record.record_id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['store', 'release', 'view', 'form_management', 'pdf_management', 'user_management', 'delete_records'].map(permission => (
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
                          permission === 'user_management' ? 'Управлять пользователями' :
                          permission === 'delete_records' ? 'Удалять записи' : permission
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
                               permission === 'user_management' ? 'Управлять пользователями' :
                               permission === 'delete_records' ? 'Удалять записи' : permission}
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
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Поля формы:</h3>
                  <button
                    onClick={() => {
                      const newField = {
                        name: `custom_field_${Date.now()}`,
                        label: 'Новое поле',
                        type: 'text',
                        required: false
                      };
                      setFormConfig({...formConfig, fields: [...formConfig.fields, newField]});
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Добавить поле
                  </button>
                </div>
                
                {formConfig.fields.map((field, index) => (
                  <div 
                    key={index} 
                    className="border border-gray-200 rounded-lg p-4 cursor-move transition-colors hover:bg-gray-50"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="flex items-center mb-3">
                      <span className="text-gray-400 mr-2 text-lg">≡</span>
                      <span className="text-sm text-gray-600">Перетащите для изменения порядка</span>
                    </div>
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
                      <div className="flex items-center justify-between">
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
                        {field.name.startsWith('custom_field_') && (
                          <button
                            onClick={() => {
                              if (window.confirm('Удалить это поле? Данные будут потеряны для всех записей.')) {
                                const newFields = formConfig.fields.filter((_, i) => i !== index);
                                setFormConfig({...formConfig, fields: newFields});
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                          >
                            Удалить
                          </button>
                        )}
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
                <span>{"{"}full_name{"}"} - ФИО</span>
                <span>{"{"}phone{"}"} - Телефон</span>
                <span>{"{"}parameters{"}"} - Параметры</span>
                <span>{"{"}size{"}"} - Размер</span>
                <span>{"{"}storage_location{"}"} - Место хранения</span>
                <span>{"{"}record_number{"}"} - Номер акта</span>
                <span>{"{"}created_at{"}"} - Дата создания</span>
                <span>{"{"}car_brand{"}"} - Марка машины</span>
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
                  onClick={loadPdfTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Загрузить из базы данных
                </button>
                
                <button
                  onClick={() => {
                    setPdfTemplate('');
                    setPdfTemplateLoaded(false);
                  }}
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

        {/* Public Calculator Page */}
        {currentPage === 'public-calculator' && (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Калькулятор Шиномонтажа</h1>
                  <p className="text-gray-600 mb-8">Рассчитайте стоимость услуг шиномонтажа онлайн</p>
                  
                  {/* Vehicle Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Тип транспорта</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          setSelectedVehicleType('passenger');
                          loadCalculatorSettings('passenger');
                        }}
                        className={`px-6 py-3 rounded-lg font-medium ${
                          selectedVehicleType === 'passenger'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Легковой автомобиль
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVehicleType('truck');
                          loadCalculatorSettings('truck');
                        }}
                        className={`px-6 py-3 rounded-lg font-medium ${
                          selectedVehicleType === 'truck'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Грузовой автомобиль
                      </button>
                    </div>
                  </div>

                  {calculatorSettings[selectedVehicleType] && (
                    <>
                      {/* Tire Size Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Размер шин</label>
                        <select
                          value={selectedTireSize}
                          onChange={(e) => setSelectedTireSize(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Object.keys(calculatorSettings[selectedVehicleType].services[0]?.time_by_size || {}).map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>

                      {/* Wheel Count */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Количество колес</label>
                        <div className="flex space-x-4">
                          {[1, 2, 4].map(count => (
                            <button
                              key={count}
                              onClick={() => setWheelCount(count)}
                              className={`px-4 py-2 rounded-lg font-medium ${
                                wheelCount === count
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {count} {count === 1 ? 'колесо' : count === 2 ? 'колеса' : 'колеса'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Services Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Услуги</label>
                        <div className="space-y-3">
                          {calculatorSettings[selectedVehicleType].services.map(service => (
                            <div key={service.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={service.id}
                                  checked={selectedServices.includes(service.id)}
                                  onChange={() => toggleService(service.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="ml-3">
                                  <label htmlFor={service.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                    {service.name}
                                  </label>
                                  <p className="text-sm text-gray-500">{service.time_by_size[selectedTireSize] || 0} мин/колесо</p>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <button
                                  onClick={() => showInfoModal(service.name, service.description)}
                                  className="text-blue-600 hover:text-blue-800 ml-2"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Additional Options */}
                      {calculatorSettings[selectedVehicleType].additional_options.length > 0 && (
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-3">Дополнительные опции</label>
                          <div className="space-y-3">
                            {calculatorSettings[selectedVehicleType].additional_options.map(option => (
                              <div key={option.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={option.id}
                                    checked={selectedOptions.includes(option.id)}
                                    onChange={() => toggleOption(option.id)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor={option.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                      {option.name}
                                    </label>
                                    <p className="text-sm text-gray-500">×{option.time_multiplier}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => showInfoModal(option.name, option.description)}
                                  className="text-blue-600 hover:text-blue-800 ml-2"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Results */}
                      {calculationResult && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                          <h3 className="text-lg font-medium text-blue-900 mb-4">Результат расчета</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-blue-700">Общее время:</p>
                              <p className="text-xl font-bold text-blue-900">{calculationResult.total_time} минут</p>
                            </div>
                            <div>
                              <p className="text-sm text-blue-700">Общая стоимость:</p>
                              <p className="text-xl font-bold text-blue-900">{calculationResult.total_cost} рублей</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={saveCalculationResult}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                          >
                            Сохранить и получить ссылку
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calculator Result Page */}
        {currentPage === 'calculator-result' && calculatorResult && (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-6">Результат расчета</h1>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Параметры</h3>
                      <div className="space-y-2">
                        <p><span className="font-medium">Тип транспорта:</span> {calculatorResult.calculation.vehicle_type === 'passenger' ? 'Легковой' : 'Грузовой'}</p>
                        <p><span className="font-medium">Размер шин:</span> {calculatorResult.calculation.tire_size}</p>
                        <p><span className="font-medium">Количество колес:</span> {calculatorResult.calculation.wheel_count}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Стоимость</h3>
                      <div className="space-y-2">
                        <p><span className="font-medium">Время:</span> {calculatorResult.calculation.total_time} минут</p>
                        <p><span className="font-medium">Стоимость:</span> {calculatorResult.calculation.total_cost} рублей</p>
                        <p><span className="font-medium">Дата расчета:</span> {new Date(calculatorResult.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Выбранные услуги</h3>
                    <div className="space-y-2">
                      {calculatorResult.calculation.breakdown.services.map(service => (
                        <div key={service.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span>{service.name}</span>
                          <span>{service.total_time} мин</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => window.location.href = '/calculator'}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Создать новый расчет
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Печать
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{infoModalContent.title}</h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mb-4">{infoModalContent.description}</p>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {/* Public Calculator Page */}
        {currentPage === 'public-calculator' && (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Калькулятор Шиномонтажа</h1>
                  <p className="text-gray-600 mb-8">Рассчитайте стоимость услуг шиномонтажа онлайн</p>
                  
                  {/* Vehicle Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Тип транспорта</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          setSelectedVehicleType('passenger');
                          loadCalculatorSettings('passenger');
                        }}
                        className={`px-6 py-3 rounded-lg font-medium ${
                          selectedVehicleType === 'passenger'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Легковой автомобиль
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVehicleType('truck');
                          loadCalculatorSettings('truck');
                        }}
                        className={`px-6 py-3 rounded-lg font-medium ${
                          selectedVehicleType === 'truck'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Грузовой автомобиль
                      </button>
                    </div>
                  </div>

                  {calculatorSettings[selectedVehicleType] && (
                    <>
                      {/* Tire Size Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Размер шин</label>
                        <select
                          value={selectedTireSize}
                          onChange={(e) => setSelectedTireSize(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Object.keys(calculatorSettings[selectedVehicleType].services[0]?.time_by_size || {}).map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>

                      {/* Wheel Count */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Количество колес</label>
                        <div className="flex space-x-4">
                          {[1, 2, 4].map(count => (
                            <button
                              key={count}
                              onClick={() => setWheelCount(count)}
                              className={`px-4 py-2 rounded-lg font-medium ${
                                wheelCount === count
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {count} {count === 1 ? 'колесо' : count === 2 ? 'колеса' : 'колеса'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Services Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Услуги</label>
                        <div className="space-y-3">
                          {calculatorSettings[selectedVehicleType].services.map(service => (
                            <div key={service.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={service.id}
                                  checked={selectedServices.includes(service.id)}
                                  onChange={() => toggleService(service.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="ml-3">
                                  <label htmlFor={service.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                    {service.name}
                                  </label>
                                  <p className="text-sm text-gray-500">{service.time_by_size[selectedTireSize] || 0} мин/колесо</p>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <button
                                  onClick={() => showInfoModal(service.name, service.description)}
                                  className="text-blue-600 hover:text-blue-800 ml-2"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Additional Options */}
                      {calculatorSettings[selectedVehicleType].additional_options.length > 0 && (
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-3">Дополнительные опции</label>
                          <div className="space-y-3">
                            {calculatorSettings[selectedVehicleType].additional_options.map(option => (
                              <div key={option.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={option.id}
                                    checked={selectedOptions.includes(option.id)}
                                    onChange={() => toggleOption(option.id)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor={option.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                                      {option.name}
                                    </label>
                                    <p className="text-sm text-gray-500">×{option.time_multiplier}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => showInfoModal(option.name, option.description)}
                                  className="text-blue-600 hover:text-blue-800 ml-2"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Results */}
                      {calculationResult && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                          <h3 className="text-lg font-medium text-blue-900 mb-4">Результат расчета</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-blue-700">Общее время:</p>
                              <p className="text-xl font-bold text-blue-900">{calculationResult.total_time} минут</p>
                            </div>
                            <div>
                              <p className="text-sm text-blue-700">Общая стоимость:</p>
                              <p className="text-xl font-bold text-blue-900">{calculationResult.total_cost} рублей</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={saveCalculationResult}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                          >
                            Сохранить и получить ссылку
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calculator Result Page */}
        {currentPage === 'calculator-result' && calculatorResult && (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-6">Результат расчета</h1>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Параметры</h3>
                      <div className="space-y-2">
                        <p><span className="font-medium">Тип транспорта:</span> {calculatorResult.calculation.vehicle_type === 'passenger' ? 'Легковой' : 'Грузовой'}</p>
                        <p><span className="font-medium">Размер шин:</span> {calculatorResult.calculation.tire_size}</p>
                        <p><span className="font-medium">Количество колес:</span> {calculatorResult.calculation.wheel_count}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Стоимость</h3>
                      <div className="space-y-2">
                        <p><span className="font-medium">Время:</span> {calculatorResult.calculation.total_time} минут</p>
                        <p><span className="font-medium">Стоимость:</span> {calculatorResult.calculation.total_cost} рублей</p>
                        <p><span className="font-medium">Дата расчета:</span> {new Date(calculatorResult.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Выбранные услуги</h3>
                    <div className="space-y-2">
                      {calculatorResult.calculation.breakdown.services.map(service => (
                        <div key={service.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span>{service.name}</span>
                          <span>{service.total_time} мин</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => window.location.href = '/calculator'}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Создать новый расчет
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Печать
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{infoModalContent.title}</h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mb-4">{infoModalContent.description}</p>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {/* Record Detail Modal */}
        {showRecordDetail && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Запись № {selectedRecord.record_number}
                </h2>
                <button
                  onClick={() => {
                    setShowRecordDetail(false);
                    setSelectedRecord(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Основная информация</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ФИО</label>
                    <p className="text-sm text-gray-900">{selectedRecord.full_name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Телефон</label>
                    <p className="text-sm text-gray-900">{selectedRecord.phone}</p>
                  </div>
                  
                  {selectedRecord.phone_additional && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Доп. телефон</label>
                      <p className="text-sm text-gray-900">{selectedRecord.phone_additional}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Марка машины</label>
                    <p className="text-sm text-gray-900">{selectedRecord.car_brand}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Параметры</label>
                    <p className="text-sm text-gray-900">{selectedRecord.parameters}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Размер/Количество</label>
                    <p className="text-sm text-gray-900">{selectedRecord.size}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Место хранения</label>
                    <p className="text-sm text-gray-900">{selectedRecord.storage_location}</p>
                  </div>
                </div>

                {/* Status and Retail Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Статус и данные</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Статус</label>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedRecord.status === 'Взята на хранение' ? 'bg-green-100 text-green-800' :
                      selectedRecord.status === 'Новая' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedRecord.status}
                    </span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Дата создания</label>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedRecord.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Создал</label>
                    <p className="text-sm text-gray-900">{selectedRecord.created_by}</p>
                  </div>
                  
                  {selectedRecord.retailcrm_order_number && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Номер заказа CRM</label>
                      <p className="text-sm text-gray-900">{selectedRecord.retailcrm_order_number}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Статус в Retail</label>
                    <p className="text-sm text-gray-900">{selectedRecord.retail_status_text}</p>
                  </div>

                  {/* Additional custom fields */}
                  {Object.entries(selectedRecord).map(([key, value]) => {
                    if (key.startsWith('custom_field_') && value) {
                      return (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700">
                            {key.replace('custom_field_', 'Поле ')}
                          </label>
                          <p className="text-sm text-gray-900">{value}</p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t">
                {selectedRecord.status === 'Новая' && hasPermission('store') && (
                  <button
                    onClick={() => {
                      handleTakeToStorage(selectedRecord.record_id);
                      setShowRecordDetail(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Взять на хранение
                  </button>
                )}
                
                {selectedRecord.status === 'Взята на хранение' && hasPermission('release') && (
                  <button
                    onClick={() => {
                      handleRelease(selectedRecord.record_id);
                      setShowRecordDetail(false);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Выдать с хранения
                  </button>
                )}
                
                <button
                  onClick={() => generatePDF(selectedRecord.record_id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Распечатать акт
                </button>
                
                {hasPermission('delete_records') && (
                  <button
                    onClick={() => {
                      deleteRecord(selectedRecord.record_id);
                      setShowRecordDetail(false);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Удалить запись
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;