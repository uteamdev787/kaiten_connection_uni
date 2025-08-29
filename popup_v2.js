// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

// Инициализация iframe SDK (как в оригинале)
const iframe = Addon.iframe();

// DOM элементы
const statusInfo = document.getElementById('status-info');
const mainUI = document.getElementById('main-ui');
const innInput = document.getElementById('innInput');
const loader = document.getElementById('loader');
const resultsBlock = document.getElementById('results');
const noResultsBlock = document.getElementById('noResults');
const choicesContainer = document.getElementById('choices');
const setParentButton = document.getElementById('setParentButton');
const cancelButton = document.getElementById('cancelButton');
const contentDiv = document.getElementById('content');

let currentCardId = null;

function setStatus(message, isError = false) {
  console.log(message);
  if (statusInfo) {
    statusInfo.textContent = message;
    statusInfo.style.color = isError ? 'red' : '';
  }
}

// Получение space_id через boardId (если есть)
async function getSpaceIdFromBoard(boardId) {
  if (!boardId) return null;
  
  try {
    setStatus('3.1/6: Пробуем получить пространство через доску...');
    
    // Попробуем прямой API запрос к доске
    const boardData = await iframe.api.get(`/boards/${boardId}`);
    if (boardData && boardData.space_id) {
      return boardData.space_id;
    }
  } catch (error) {
    console.log('Ошибка получения данных доски:', error);
  }
  
  return null;
}

// Получение space_id через карточку
async function getSpaceIdFromCard(cardId) {
  try {
    setStatus('3.2/6: Пробуем получить пространство через карточку...');
    
    // Способ 1: Через контекст карточки
    try {
      const cardContext = await iframe.getCardContext();
      console.log('Card context:', cardContext);
      if (cardContext && cardContext.space_id) {
        return cardContext.space_id;
      }
    } catch (e) {
      console.log('getCardContext не сработал:', e);
    }
    
    // Способ 2: Через API карточки
    try {
      const cardData = await iframe.api.get(`/cards/${cardId}`);
      console.log('Card data from API:', cardData);
      if (cardData && cardData.space && cardData.space.id) {
        return cardData.space.id;
      }
    } catch (e) {
      console.log('API запрос карточки не сработал:', e);
    }
    
    // Способ 3: Попробуем получить данные карточки через cards.get
    try {
      const card = await iframe.cards.get(cardId);
      console.log('Card from cards.get:', card);
      if (card && card.space && card.space.id) {
        return card.space.id;
      }
    } catch (e) {
      console.log('cards.get не сработал:', e);
    }
    
  } catch (error) {
    console.log('Общая ошибка получения space_id через карточку:', error);
  }
  
  return null;
}

// Проверим все доступные пространства и попробуем угадать
async function tryGuessSpaceFromCards(innValue) {
  setStatus('3.3/6: Попытка определить пространство через поиск...');
  
  // Проверим все пространства из конфигурации
  for (const [inputSpaceId, searchSpaceId] of Object.entries(spaceMap)) {
    try {
      // Попробуем найти карточки в поисковом пространстве
      const foundCards = await iframe.cards.find({
        space_id: parseInt(searchSpaceId),
        custom_fields: [{ 
          field_id: innFieldId, 
          value: innValue 
        }]
      });
      
      if (foundCards && foundCards.length > 0) {
        console.log(`Найдены карточки в пространстве ${searchSpaceId}, значит текущее пространство: ${inputSpaceId}`);
        return parseInt(inputSpaceId);
      }
    } catch (e) {
      console.log(`Ошибка поиска в пространстве ${searchSpaceId}:`, e);
    }
  }
  
  return null;
}

iframe.render(async () => {
  try {
    setStatus('1/6: SDK готов, читаем параметры...');
    
    // Отладочная информация
    console.log('iframe object:', iframe);
    console.log('Available iframe methods:', Object.keys(iframe));
    
    // 2. Чтение параметров из URL
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('card_id');
    const boardId = urlParams.get('board_id');

    if (!cardId) {
      throw new Error('Не удалось получить card_id из URL');
    }
    
    currentCardId = cardId;
    setStatus(`2/6: Параметры получены. Card ID: ${cardId}, Board ID: ${boardId || 'нет'}`);
    
    // 3. Сначала получим значение ИНН (это точно работает)
    setStatus('3/6: Получение значения ИНН...');
    const cardProps = await iframe.getCardProperties('customProperties');
    
    if (!cardProps || !Array.isArray(cardProps)) {
      throw new Error('Не удалось получить кастомные свойства карточки');
    }
    
    const innField = cardProps.find(prop => 
      prop.property && prop.property.id === innFieldId
    );
    
    if (!innField || !innField.value) {
      throw new Error(`Поле ИНН (ID ${innFieldId}) не найдено или пустое`);
    }
    
    const innValue = innField.value;
    innInput.value = innValue;
    setStatus(`ИНН получен: ${innValue}. Определяем пространство...`);
    
    // 4. Пробуем получить space_id разными способами
    let currentSpaceId = null;
    
    // Попробуем через доску
    currentSpaceId = await getSpaceIdFromBoard(boardId);
    
    // Если не получилось, попробуем через карточку
    if (!currentSpaceId) {
      currentSpaceId = await getSpaceIdFromCard(cardId);
    }
    
    // Если всё еще не получилось, попробуем угадать через поиск
    if (!currentSpaceId) {
      currentSpaceId = await tryGuessSpaceFromCards(innValue);
    }
    
    // Если не удалось определить автоматически, показываем выбор
    if (!currentSpaceId) {
      setStatus('4/6: Не удалось автоматически определить пространство. Показываем все варианты...');
      await showAllPossibleResults(innValue);
      return;
    }
    
    setStatus(`4/6: Пространство определено: ${currentSpaceId}`);
    
    // 5. Проверяем настройку
    const searchSpaceId = spaceMap[currentSpaceId];
    if (!searchSpaceId) {
      setStatus(`Пространство ${currentSpaceId} не настроено. Показываем все варианты...`);
      await showAllPossibleResults(innValue);
      return;
    }
    
    setStatus(`5/6: Ищем в пространстве ${searchSpaceId}...`);
    
    // Показываем UI
    if (statusInfo) statusInfo.style.display = 'none';
    if (mainUI) mainUI.style.display = 'block';
    if (loader) loader.style.display = 'block';
    iframe.fitSize(contentDiv);

    // 6. Поиск карточек
    const foundCards = await iframe.cards.find({
      space_id: searchSpaceId,
      custom_fields: [{ 
        field_id: innFieldId, 
        value: innValue 
      }]
    });

    await showSearchResults(foundCards);

  } catch (error) {
    setStatus(`Критическая ошибка: ${error.message}`, true);
    console.error('Полная ошибка:', error);
  }
});

// Показать результаты поиска во всех пространствах
async function showAllPossibleResults(innValue) {
  setStatus('Поиск во всех настроенных пространствах...');
  
  if (statusInfo) statusInfo.style.display = 'none';
  if (mainUI) mainUI.style.display = 'block';
  if (loader) loader.style.display = 'block';
  iframe.fitSize(contentDiv);

  const allFoundCards = [];
  
  // Ищем во всех поисковых пространствах
  for (const searchSpaceId of Object.values(spaceMap)) {
    try {
      const foundCards = await iframe.cards.find({
        space_id: parseInt(searchSpaceId),
        custom_fields: [{ 
          field_id: innFieldId, 
          value: innValue 
        }]
      });
      
      if (foundCards && foundCards.length > 0) {
        allFoundCards.push(...foundCards);
      }
    } catch (e) {
      console.log(`Ошибка поиска в пространстве ${searchSpaceId}:`, e);
    }
  }
  
  await showSearchResults(allFoundCards);
}

// Показать результаты поиска
async function showSearchResults(foundCards) {
  if (loader) loader.style.display = 'none';

  if (!foundCards || foundCards.length === 0) {
    if (noResultsBlock) noResultsBlock.style.display = 'block';
  } else {
    // Очищаем контейнер и добавляем найденные карточки
    choicesContainer.innerHTML = '';
    
    foundCards.forEach(card => {
      const radioId = `card-${card.id}`;
      const label = document.createElement('label');
      label.className = 'radio-label';
      label.innerHTML = `
        <input type="radio" name="parentCard" value="${card.id}" id="${radioId}"> 
        #${card.id} - ${card.title}
      `;
      choicesContainer.appendChild(label);
    });
    
    if (resultsBlock) resultsBlock.style.display = 'block';
    
    // Включаем кнопку "Связать" когда выбрана карточка
    choicesContainer.addEventListener('change', () => {
      setParentButton.disabled = false;
    });
  }
  
  iframe.fitSize(contentDiv);
}

// Обработчик кнопки "Связать с договором"
setParentButton.addEventListener('click', async () => {
  const selectedRadio = document.querySelector('input[name="parentCard"]:checked');
  if (!selectedRadio) return;
  
  const parentCardId = parseInt(selectedRadio.value, 10);
  
  try {
    setParentButton.disabled = true;
    setParentButton.textContent = 'Связывание...';
    
    await iframe.cards.update(currentCardId, { 
      parent_id: parentCardId 
    });
    
    iframe.showSnackbar('Связь с договором установлена!', 'success');
    iframe.closePopup();
    
  } catch (error) {
    console.error('Ошибка при установке родителя:', error);
    iframe.showSnackbar('Не удалось установить родительскую карточку.', 'error');
    setParentButton.disabled = false;
    setParentButton.textContent = 'Связать с договором';
  }
});

// Обработчик кнопки "Отмена"
cancelButton.addEventListener('click', () => {
  if (iframe && iframe.closePopup) {
    iframe.closePopup();
  }
});
