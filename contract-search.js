const iframe = Addon.iframe();

// Конфигурация - соответствует main.js
const spaceMap = {
  517319: 517325, // Счета -> Договоры
  517314: 532009, // Счета -> Договоры  
  517324: 532011  // Счета -> Договоры
};
const innFieldId = 415447;

// DOM элементы
const innBadge = document.getElementById('innBadge');
const loadingState = document.getElementById('loadingState');
const resultsState = document.getElementById('resultsState');
const noResultsState = document.getElementById('noResultsState');
const contractsList = document.getElementById('contractsList');
const linkBtn = document.getElementById('linkBtn');
const cancelBtn = document.getElementById('cancelBtn');
const searchInterface = document.getElementById('searchInterface');

// Состояние
let currentCard = null;
let innValue = null;
let foundContracts = [];
let selectedContractId = null;

// Функция отображения найденных договоров
function displayContracts(contracts) {
  contractsList.innerHTML = '';
  
  contracts.forEach(contract => {
    const contractCard = document.createElement('div');
    contractCard.className = 'contract-card';
    contractCard.dataset.contractId = contract.id;
    
    // Обрезаем описание для компактности
    const description = contract.description ? 
      (contract.description.length > 150 ? 
        contract.description.substring(0, 150) + '...' : 
        contract.description) : 
      'Описание отсутствует';
    
    contractCard.innerHTML = `
      <div class="contract-header">
        <div class="contract-title">${contract.title}</div>
        <div class="contract-id">#${contract.id}</div>
      </div>
      <div class="contract-description">${description}</div>
      <div class="contract-meta">
        <span>📁 Пространство: ${contract.space_id || 'Неизвестно'}</span>
        <span>📅 Обновлен: ${contract.updated ? new Date(contract.updated).toLocaleDateString('ru-RU') : 'Неизвестно'}</span>
      </div>
    `;
    
    // Обработчик выбора договора
    contractCard.addEventListener('click', () => {
      // Снимаем выделение с других карточек
      document.querySelectorAll('.contract-card').forEach(card => {
        card.classList.remove('selected');
      });
      
      // Выделяем выбранную карточку
      contractCard.classList.add('selected');
      selectedContractId = contract.id;
      
      // Активируем кнопку связывания
      linkBtn.disabled = false;
      linkBtn.textContent = `🔗 Привязать к договору #${contract.id}`;
    });
    
    contractsList.appendChild(contractCard);
  });
}

// Функция поиска договоров
async function searchContracts() {
  try {
    // Определяем пространство для поиска
    const currentSpaceId = currentCard.space?.id || currentCard.space_id;
    const contractsSpaceId = spaceMap[currentSpaceId];
    
    console.log('🔍 Поиск в пространстве:', contractsSpaceId);
    
    if (!contractsSpaceId) {
      throw new Error(`Поиск договоров для пространства ${currentSpaceId} не настроен`);
    }

    // Выполняем поиск через iframe API
    const contracts = await iframe.requestWithContext({
      method: 'GET',
      url: '/cards',
      params: {
        space_id: contractsSpaceId,
        [`custom_fields[${innFieldId}]`]: innValue
      }
    });

    foundContracts = contracts.filter(contract => contract.id !== currentCard.id);
    
    console.log(`📋 Найдено договоров: ${foundContracts.length}`);
    
    // Скрываем загрузку
    loadingState.style.display = 'none';
    
    if (foundContracts.length === 0) {
      noResultsState.style.display = 'block';
    } else {
      resultsState.style.display = 'block';
      displayContracts(foundContracts);
    }
    
    // Подгоняем размер окна
    iframe.fitSize(searchInterface);
    
  } catch (error) {
    console.error('❌ Ошибка поиска:', error);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    
    // Изменяем сообщение об ошибке
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--addon-error-color);">
        Ошибка поиска
      </div>
      <div style="line-height: 1.5;">
        ${error.message || 'Не удалось выполнить поиск договоров'}
      </div>
      <div style="margin-top: 16px; font-size: 12px;">
        Проверьте подключение и права доступа
      </div>
    `;
  }
}

// Функция связывания счета с договором
async function linkToContract() {
  if (!selectedContractId) {
    iframe.showSnackbar('Выберите договор для привязки', 'warning');
    return;
  }

  try {
    linkBtn.disabled = true;
    linkBtn.textContent = '⏳ Привязываем...';
    
    // Устанавливаем родительскую связь
    await iframe.requestWithContext({
      method: 'PUT',
      url: `/cards/${currentCard.id}`,
      data: {
        parent_id: selectedContractId
      }
    });
    
    // Находим выбранный договор для отображения имени
    const selectedContract = foundContracts.find(c => c.id === selectedContractId);
    const contractTitle = selectedContract ? selectedContract.title : `#${selectedContractId}`;
    
    iframe.showSnackbar(`✅ Счет успешно привязан к договору "${contractTitle}"!`, 'success');
    iframe.closePopup();
    
  } catch (error) {
    console.error('❌ Ошибка связывания:', error);
    
    // Показываем детальную ошибку
    let errorMessage = 'Не удалось привязать счет к договору';
    if (error.response && error.response.status === 403) {
      errorMessage = 'Недостаточно прав для изменения карточки';
    } else if (error.response && error.response.status === 404) {
      errorMessage = 'Карточка не найдена';
    }
    
    iframe.showSnackbar(errorMessage, 'error');
    
    // Восстанавливаем кнопку
    linkBtn.disabled = false;
    linkBtn.textContent = '🔗 Привязать к выбранному договору';
  }
}

// Обработчики событий
cancelBtn.addEventListener('click', () => {
  iframe.closePopup();
});

linkBtn.addEventListener('click', linkToContract);

// Инициализация при загрузке popup
iframe.render(async () => {
  try {
    // Получаем текущую карточку напрямую в контексте popup
    currentCard = await iframe.getCard();
    
    if (!currentCard) {
      throw new Error('Не удалось получить данные карточки');
    }

    // Извлекаем ИНН из свойств карточки
    const innKey = `id_${innFieldId}`;
    innValue = currentCard.properties && currentCard.properties[innKey];
    
    if (!innValue || innValue.trim().length === 0) {
      throw new Error('Поле ИНН не заполнено в карточке');
    }

    innValue = innValue.trim();
    console.log('📥 Получена карточка:', currentCard.id);
    console.log('🎯 ИНН для поиска:', innValue);
    console.log('📋 Полные данные карточки:', JSON.stringify(currentCard, null, 2));
    
    // Отображаем ИНН
    innBadge.textContent = `ИНН: ${innValue}`;
    
    // Пытаемся определить пространство разными способами
    let currentSpaceId = currentCard.space?.id || currentCard.space_id;
    
    // Если прямо пространство не найдено, пытаемся через board
    if (!currentSpaceId && currentCard.board) {
      currentSpaceId = currentCard.board.space?.id || currentCard.board.space_id;
      console.log('📍 Пространство найдено через board:', currentSpaceId);
    }
    
    // Статический маппинг board_id -> space_id как резерв
    if (!currentSpaceId && currentCard.board_id) {
      const boardToSpaceMap = {
        1183281: 517319, // Пример: board_id -> space_id (нужно настроить под ваши данные)
        // Добавьте другие маппинги здесь при необходимости
      };
      currentSpaceId = boardToSpaceMap[currentCard.board_id];
      console.log('📍 Пространство найдено через board_id:', currentSpaceId);
    }
    
    console.log('🏢 Определенное пространство:', currentSpaceId);
    console.log('🔍 Доступные ключи карточки:', Object.keys(currentCard));
    
    const contractsSpaceId = spaceMap[currentSpaceId];
    
    if (!contractsSpaceId) {
      // Показываем больше информации для отладки
      const availableSpaces = Object.keys(spaceMap).join(', ');
      const debugInfo = `
Текущее пространство: ${currentSpaceId || 'НЕ ОПРЕДЕЛЕНО'}
Настроенные пространства: ${availableSpaces}
Board ID: ${currentCard.board_id || 'НЕ ОПРЕДЕЛЕН'}
      `.trim();
      
      throw new Error(`Поиск договоров для пространства ${currentSpaceId || 'НЕ ОПРЕДЕЛЕНО'} не настроен.\n\n${debugInfo}`);
    }
    
    console.log(`🎯 Поиск договоров: пространство ${currentSpaceId} -> ${contractsSpaceId}`);
    
    // Запускаем поиск
    await searchContracts();
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--addon-error-color);">
        Ошибка инициализации
      </div>
      <div style="line-height: 1.5;">
        ${error.message}
      </div>
    `;
  }
});