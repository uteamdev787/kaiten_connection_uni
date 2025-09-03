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
let searchConfig = null;

// Функция отображения найденных договоров
function displayContracts(contracts) {
  contractsList.innerHTML = '';
  
  contracts.forEach(contract => {
    const contractCard = document.createElement('div');
    contractCard.className = 'contract-card';
    contractCard.dataset.contractId = contract.id;
    
    // Получаем ИНН из properties для отображения
    const contractINN = contract.properties && contract.properties[`id_${innFieldId}`];
    
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
        <span>🏢 ИНН: ${contractINN || 'Не указан'}</span>
        <span>📁 Доска: ${contract.board_id || 'Неизвестно'}</span>
        <span>📅 ${contract.updated ? new Date(contract.updated).toLocaleDateString('ru-RU') : 'Неизвестно'}</span>
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

// Функция определения конфигурации поиска
function determineSearchConfig(card) {
  console.log('Определяем конфигурацию поиска для карточки:', card.id);
  console.log('Board ID карточки:', card.board_id);
  console.log('Space ID карточки:', card.space_id);
  
  // Проверяем наличие space_id и его маппинг
  if (card.space_id && spaceMap[card.space_id]) {
    const targetSpaceId = spaceMap[card.space_id];
    console.log(`Используем маппинг пространств: ${card.space_id} -> ${targetSpaceId}`);
    return {
      method: 'space',
      currentId: card.space_id,
      targetId: targetSpaceId,
      searchBy: 'space_id'
    };
  }
  
  // Используем board_id как основной метод
  if (card.board_id && boardMap[card.board_id]) {
    const targetBoardId = boardMap[card.board_id];
    console.log(`Используем маппинг досок: ${card.board_id} -> ${targetBoardId}`);
    return {
      method: 'board',
      currentId: card.board_id,
      targetId: targetBoardId,
      searchBy: 'board_id'
    };
  }
  
  // Генерируем подробную ошибку
  const debugInfo = {
    cardId: card.id,
    spaceId: card.space_id,
    boardId: card.board_id,
    availableSpaces: Object.keys(spaceMap),
    availableBoards: Object.keys(boardMap),
    allCardKeys: Object.keys(card).slice(0, 20) // Первые 20 ключей
  };
  
  console.error('Отладочная информация:', debugInfo);
  
  throw new Error(`Не найден маппинг для карточки.\nSpace ID: ${card.space_id || 'нет'}\nBoard ID: ${card.board_id || 'нет'}\n\nДоступные пространства: ${Object.keys(spaceMap).join(', ')}\nДоступные доски: ${Object.keys(boardMap).join(', ')}`);
}

// Функция поиска договоров с упрощенным подходом
async function searchContracts() {
  try {
    console.log('Начинаем поиск договоров');
    console.log('Конфигурация поиска:', searchConfig);
    
    // Сначала получаем все карточки с целевой доски/пространства
    const searchParams = {};
    searchParams[searchConfig.searchBy] = searchConfig.targetId;
    
    console.log('Параметры API запроса:', searchParams);

    // Получаем все карточки
    const allCards = await iframe.requestWithContext({
      method: 'GET',
      url: '/cards',
      params: searchParams
    });

    console.log(`Получено карточек с ${searchConfig.searchBy} ${searchConfig.targetId}:`, allCards.length);
    
    // Фильтруем карточки по ИНН локально
    const innKey = `id_${innFieldId}`;
    const contractsWithINN = allCards.filter(card => {
      // Проверяем наличие поля ИНН и его значение
      const cardINN = card.properties && card.properties[innKey];
      const matches = cardINN && cardINN.toString().trim() === innValue;
      
      if (matches) {
        console.log(`Найден договор с ИНН: #${card.id} - ${card.title}`);
      }
      
      return matches && card.id !== currentCard.id; // Исключаем текущую карточку
    });

    foundContracts = contractsWithINN;
    
    console.log(`Отфильтровано договоров с ИНН ${innValue}: ${foundContracts.length}`);
    
    // Скрываем загрузку
    loadingState.style.display = 'none';
    
    if (foundContracts.length === 0) {
      // Показываем дополнительную информацию для отладки
      const totalCards = allCards.length;
      const cardsWithProperties = allCards.filter(card => card.properties).length;
      const cardsWithINN = allCards.filter(card => 
        card.properties && card.properties[innKey]
      ).length;
      
      console.log(`Отладка поиска ИНН:`);
      console.log(`- Всего карточек на доске: ${totalCards}`);
      console.log(`- Карточек с properties: ${cardsWithProperties}`);
      console.log(`- Карточек с полем ИНН: ${cardsWithINN}`);
      
      if (cardsWithINN > 0) {
        const sampleINNs = allCards
          .filter(card => card.properties && card.properties[innKey])
          .slice(0, 5)
          .map(card => `#${card.id}: "${card.properties[innKey]}"`)
          .join(', ');
        console.log(`Примеры ИНН на доске: ${sampleINNs}`);
      }
      
      noResultsState.style.display = 'block';
      noResultsState.innerHTML = `
        <div class="no-results-icon">📄</div>
        <div style="font-weight: 600; margin-bottom: 8px;">
          Договоры не найдены
        </div>
        <div style="line-height: 1.5; margin-bottom: 12px;">
          Договоры с ИНН "${innValue}" не найдены на доске ${searchConfig.targetId}
        </div>
        <div style="font-size: 12px; color: var(--addon-text-secondary-color);">
          Всего карточек на доске: ${totalCards}<br>
          Карточек с полем ИНН: ${cardsWithINN}
        </div>
      `;
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
      <div style="line-height: 1.5; margin-bottom: 8px;">
        ${error.message || 'Не удалось выполнить поиск договоров'}
      </div>
      <div style="font-size: 11px; color: var(--addon-text-secondary-color);">
        Метод: ${searchConfig?.method || 'не определен'}<br>
        Target ID: ${searchConfig?.targetId || 'не определен'}
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
    linkBtn.textContent = 'Привязываем...';
    
    console.log(`Связывание: договор #${selectedContractId} <- счет #${currentCard.id}`);
    
    // Пытаемся связать через добавление дочерней карточки
    const response = await iframe.requestWithContext({
      method: 'POST',
      url: `/cards/${selectedContractId}/children`,
      data: {
        card_id: currentCard.id
      }
    });
    
    console.log('Результат связывания:', response);
    
    // Находим выбранный договор для сообщения
    const selectedContract = foundContracts.find(c => c.id === selectedContractId);
    const contractTitle = selectedContract ? selectedContract.title : `#${selectedContractId}`;
    
    iframe.showSnackbar(`Счет привязан к договору "${contractTitle}"!`, 'success');
    iframe.closePopup();
    
  } catch (error) {
    console.error('Ошибка связывания:', error);
    
    // Пытаемся альтернативный способ - через parent_id
    try {
      console.log('Пробуем альтернативный способ связывания через parent_id');
      
      await iframe.requestWithContext({
        method: 'PUT',
        url: `/cards/${currentCard.id}`,
        data: {
          parent_id: selectedContractId
        }
      });
      
      const selectedContract = foundContracts.find(c => c.id === selectedContractId);
      const contractTitle = selectedContract ? selectedContract.title : `#${selectedContractId}`;
      
      iframe.showSnackbar(`Счет привязан к договору "${contractTitle}" (через parent_id)!`, 'success');
      iframe.closePopup();
      
    } catch (secondError) {
      console.error('Альтернативное связывание тоже не сработало:', secondError);
      
      // Показываем ошибку пользователю
      let errorMessage = 'Не удалось привязать счет к договору';
      
      if (error.response) {
        const status = error.response.status;
        switch (status) {
          case 403:
            errorMessage = 'Недостаточно прав для изменения карточек';
            break;
          case 404:
            errorMessage = 'Договор не найден';
            break;
          case 400:
            errorMessage = 'Неверный формат данных';
            break;
          case 409:
            errorMessage = 'Связь уже существует';
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
}

// Обработчики событий
cancelBtn.addEventListener('click', () => {
  iframe.closePopup();
});

linkBtn.addEventListener('click', linkToContract);

// Инициализация при загрузке popup
iframe.render(async () => {
  try {
    console.log('=== ИНИЦИАЛИЗАЦИЯ POPUP ПОИСКА ДОГОВОРОВ ===');
    
    // Получаем текущую карточку
    currentCard = await iframe.getCard();
    
    if (!currentCard) {
      throw new Error('Не удалось получить данные карточки');
    }

    console.log('Карточка:', currentCard.id);
    console.log('Board ID:', currentCard.board_id);
    console.log('Space ID:', currentCard.space_id);

    // Извлекаем ИНН из свойств карточки
    const innKey = `id_${innFieldId}`;
    innValue = currentCard.properties && currentCard.properties[innKey];
    
    console.log('Поле ИНН (ключ, значение):', innKey, innValue);
    console.log('Properties:', currentCard.properties);
    
    if (!innValue || innValue.toString().trim().length === 0) {
      throw new Error('Поле ИНН не заполнено в карточке');
    }

    innValue = innValue.toString().trim();
    console.log('ИНН для поиска:', innValue);
    
    // Отображаем ИНН в интерфейсе
    innBadge.textContent = `ИНН: ${innValue}`;
    
    // Определяем конфигурацию поиска
    searchConfig = determineSearchConfig(currentCard);
    console.log('Конфигурация поиска:', searchConfig);
    
    // Запускаем поиск
    await searchContracts();
    
  } catch (error) {
    console.error('=== ОШИБКА ИНИЦИАЛИЗАЦИИ ===');
    console.error('Ошибка:', error);
    console.error('Текущая карточка:', currentCard);
    
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

// Функция определения параметров поиска
function determineSearchConfig(card) {
  console.log('=== ОПРЕДЕЛЕНИЕ КОНФИГУРАЦИИ ПОИСКА ===');
  
  // Сначала пытаемся через space_id
  if (card.space_id && spaceMap[card.space_id]) {
    const config = {
      method: 'space',
      currentId: card.space_id,
      targetId: spaceMap[card.space_id],
      searchBy: 'space_id'
    };
    console.log('Конфигурация через пространство:', config);
    return config;
  }
  
  // Затем через board_id  
  if (card.board_id && boardMap[card.board_id]) {
    const config = {
      method: 'board',
      currentId: card.board_id,
      targetId: boardMap[card.board_id],
      searchBy: 'board_id'
    };
    console.log('Конфигурация через доску:', config);
    return config;
  }
  
  // Если ничего не найдено - детальная отладочная информация
  const debug = {
    cardId: card.id,
    spaceId: card.space_id,
    boardId: card.board_id,
    availableSpaceKeys: Object.keys(spaceMap),
    availableBoardKeys: Object.keys(boardMap)
  };
  
  console.error('Не удалось найти маппинг:', debug);
  throw new Error(`Маппинг не найден!\n\nТекущие ID:\n- Space: ${card.space_id || 'отсутствует'}\n- Board: ${card.board_id || 'отсутствует'}\n\nНастроенные маппинги:\n- Пространства: ${Object.keys(spaceMap).join(', ')}\n- Доски: ${Object.keys(boardMap).join(', ')}`);
}

// Функция поиска договоров на целевой доске/пространстве  
async function searchContracts() {
  try {
    console.log('=== НАЧАЛО ПОИСКА ДОГОВОРОВ ===');
    
    // Формируем параметры запроса
    const apiParams = {};
    apiParams[searchConfig.searchBy] = searchConfig.targetId;
    
    console.log('API параметры:', apiParams);

    // Получаем все карточки с целевой доски/пространства
    const allCards = await iframe.requestWithContext({
      method: 'GET',
      url: '/cards',
      params: apiParams
    });

    console.log(`API вернул карточек: ${allCards ? allCards.length : 'null/undefined'}`);
    
    if (!allCards || !Array.isArray(allCards)) {
      throw new Error('API вернул некорректные данные');
    }
    
    // Фильтруем по ИНН локально
    const innKey = `id_${innFieldId}`;
    const matchingContracts = [];
    
    allCards.forEach(card => {
      const cardINN = card.properties && card.properties[innKey];
      const cardINNString = cardINN ? cardINN.toString().trim() : '';
      
      if (cardINNString === innValue && card.id !== currentCard.id) {
        matchingContracts.push(card);
        console.log(`✅ Найден договор: #${card.id} "${card.title}" с ИНН: "${cardINNString}"`);
      } else if (cardINNString && cardINNString.includes(innValue.slice(0, 8))) {
        console.log(`🔍 Похожий ИНН: #${card.id} "${card.title}" ИНН: "${cardINNString}"`);
      }
    });

    foundContracts = matchingContracts;
    console.log(`Итого найдено подходящих договоров: ${foundContracts.length}`);
    
    // Скрываем загрузку
    loadingState.style.display = 'none';
    
    if (foundContracts.length === 0) {
      console.log('Показываем сообщение о том, что ничего не найдено');
      noResultsState.style.display = 'block';
    } else {
      console.log('Показываем найденные договоры');
      resultsState.style.display = 'block';
      displayContracts(foundContracts);
    }
    
    // Подгоняем размер окна
    iframe.fitSize(searchInterface);
    
  } catch (error) {
    console.error('=== ОШИБКА ПОИСКА ===');
    console.error('Ошибка:', error);
    console.error('Search config:', searchConfig);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--addon-error-color);">
        Ошибка поиска
      </div>
      <div style="line-height: 1.5; margin-bottom: 8px;">
        ${error.message || 'Не удалось выполнить поиск договоров'}
      </div>
      <div style="font-size: 11px; color: var(--addon-text-secondary-color);">
        ${searchConfig ? `Поиск: ${searchConfig.method} #${searchConfig.targetId}` : 'Конфигурация не определена'}
      </div>
    `;
    
    iframe.fitSize(searchInterface);
  }
}