const iframe = Addon.iframe();

// Конфигурация маппингов
const spaceMap = {
  517319: 517325, // Счета -> Договоры
  517314: 532009, // Счета -> Договоры  
  517324: 532011  // Счета -> Договоры
};

const boardMap = {
  1183281: 1183294, // Счета -> Договоры
  1183290: 1215408, // Счета -> Договоры  
  1183292: 1215428  // Счета -> Договоры
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

// Глобальное состояние
let currentCard = null;
let innValue = null;
let foundContracts = [];
let selectedContractId = null;
let searchParams = null;

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
      linkBtn.textContent = `Привязать к договору #${contract.id}`;
    });
    
    contractsList.appendChild(contractCard);
  });
}

// Функция определения параметров поиска
function determineSearchParams(card) {
  console.log('Определяем параметры поиска для карточки:', card.id);
  console.log('Board ID карточки:', card.board_id);
  console.log('Доступные ключи:', Object.keys(card));
  
  // Пытаемся найти через space_id (если есть в данных)
  const currentSpaceId = card.space_id;
  if (currentSpaceId && spaceMap[currentSpaceId]) {
    const targetSpaceId = spaceMap[currentSpaceId];
    console.log(`Найден маппинг по пространству: ${currentSpaceId} -> ${targetSpaceId}`);
    return {
      method: 'space',
      currentId: currentSpaceId,
      targetId: targetSpaceId,
      searchParams: { space_id: targetSpaceId }
    };
  }
  
  // Используем board_id
  const currentBoardId = card.board_id;
  if (currentBoardId && boardMap[currentBoardId]) {
    const targetBoardId = boardMap[currentBoardId];
    console.log(`Найден маппинг по доске: ${currentBoardId} -> ${targetBoardId}`);
    return {
      method: 'board',
      currentId: currentBoardId,
      targetId: targetBoardId,
      searchParams: { board_id: targetBoardId }
    };
  }
  
  // Ничего не найдено
  const debugInfo = {
    spaceId: currentSpaceId,
    boardId: currentBoardId,
    availableSpaces: Object.keys(spaceMap),
    availableBoards: Object.keys(boardMap)
  };
  
  console.log('Отладочная информация:', debugInfo);
  
  throw new Error(`Не найден маппинг для карточки. Space ID: ${currentSpaceId}, Board ID: ${currentBoardId}. Доступные пространства: ${Object.keys(spaceMap).join(', ')}. Доступные доски: ${Object.keys(boardMap).join(', ')}`);
}

// Функция поиска договоров
async function searchContracts() {
  try {
    console.log('Начинаем поиск договоров');
    
    // Формируем параметры поиска с полем ИНН
    const finalSearchParams = {
      ...searchParams.searchParams,
      [`custom_fields[${innFieldId}]`]: innValue
    };
    
    console.log('Параметры поиска:', finalSearchParams);

    // Выполняем поиск через iframe API
    const contracts = await iframe.requestWithContext({
      method: 'GET',
      url: '/cards',
      params: finalSearchParams
    });

    console.log('Результат API запроса:', contracts);

    // Фильтруем результаты
    foundContracts = Array.isArray(contracts) ? 
      contracts.filter(contract => contract.id !== currentCard.id) : [];
    
    console.log(`Найдено договоров после фильтрации: ${foundContracts.length}`);
    if (foundContracts.length > 0) {
      console.log('Найденные договоры:', foundContracts.map(c => `#${c.id} - ${c.title}`));
    }
    
    // Скрываем загрузку и показываем результаты
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
    console.error('Ошибка поиска договоров:', error);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    
    // Показываем детальную ошибку
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--addon-error-color);">
        Ошибка поиска
      </div>
      <div style="line-height: 1.5;">
        ${error.message || 'Не удалось выполнить поиск договоров'}
      </div>
      <div style="margin-top: 12px; font-size: 12px;">
        Проверьте права доступа и настройки маппинга
      </div>
    `;
  }
}

// Функция связывания счета с договором (счет становится дочерним к договору)
async function linkToContract() {
  if (!selectedContractId) {
    iframe.showSnackbar('Выберите договор для привязки', 'warning');
    return;
  }

  try {
    linkBtn.disabled = true;
    linkBtn.textContent = 'Привязываем...';
    
    console.log(`Связывание: договор #${selectedContractId} <- счет #${currentCard.id} (как дочерний)`);
    
    // Добавляем текущую карточку как дочернюю к выбранному договору
    const response = await iframe.requestWithContext({
      method: 'POST',
      url: `/cards/${selectedContractId}/children`,
      data: {
        card_id: currentCard.id
      }
    });
    
    console.log('Результат связывания:', response);
    
    // Находим выбранный договор для отображения имени
    const selectedContract = foundContracts.find(c => c.id === selectedContractId);
    const contractTitle = selectedContract ? selectedContract.title : `#${selectedContractId}`;
    
    iframe.showSnackbar(`Счет успешно привязан к договору "${contractTitle}"!`, 'success');
    iframe.closePopup();
    
  } catch (error) {
    console.error('Ошибка связывания:', error);
    
    // Детальная обработка ошибок
    let errorMessage = 'Не удалось привязать счет к договору';
    
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 403:
          errorMessage = 'Недостаточно прав для изменения карточек';
          break;
        case 404:
          errorMessage = 'Договор не найден или удален';
          break;
        case 400:
          errorMessage = 'Неверные данные для связывания';
          break;
        case 409:
          errorMessage = 'Карточка уже привязана к этому договору';
          break;
        default:
          errorMessage += ` (HTTP ${status})`;
      }
    }
    
    iframe.showSnackbar(errorMessage, 'error');
    
    // Восстанавливаем кнопку
    linkBtn.disabled = false;
    linkBtn.textContent = 'Привязать к выбранному договору';
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
    console.log('Инициализация popup поиска договоров');
    
    // Получаем текущую карточку
    currentCard = await iframe.getCard();
    
    if (!currentCard) {
      throw new Error('Не удалось получить данные карточки');
    }

    console.log('Получена карточка:', currentCard.id);
    console.log('Board ID:', currentCard.board_id);

    // Извлекаем ИНН из свойств карточки
    const innKey = `id_${innFieldId}`;
    innValue = currentCard.properties && currentCard.properties[innKey];
    
    if (!innValue || innValue.trim().length === 0) {
      throw new Error('Поле ИНН не заполнено в карточке');
    }

    innValue = innValue.trim();
    console.log('ИНН для поиска:', innValue);
    
    // Отображаем ИНН в интерфейсе
    innBadge.textContent = `ИНН: ${innValue}`;
    
    // Определяем параметры поиска
    searchParams = determineSearchParams(currentCard);
    console.log('Определены параметры поиска:', searchParams);
    
    // Запускаем поиск
    await searchContracts();
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--addon-error-color);">
        Ошибка инициализации
      </div>
      <div style="line-height: 1.5; margin-bottom: 12px;">
        ${error.message}
      </div>
      <div style="font-size: 12px; color: var(--addon-text-secondary-color);">
        Проверьте настройки маппинга и заполнение поля ИНН
      </div>
    `;
    
    iframe.fitSize(searchInterface);
  }
});