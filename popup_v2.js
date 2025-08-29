// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

// Инициализация iframe SDK
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

// Поиск карточек через прямой API вызов
async function findCardsByInn(spaceId, innValue) {
  try {
    // Формируем параметры для API запроса
    const params = new URLSearchParams({
      space_id: spaceId,
      'custom_fields[0][field_id]': innFieldId,
      'custom_fields[0][value]': innValue
    });
    
    const response = await iframe.api.get(`/cards?${params.toString()}`);
    return response || [];
    
  } catch (error) {
    console.log(`Ошибка поиска в пространстве ${spaceId}:`, error);
    return [];
  }
}

// Обновление карточки через прямой API
async function updateCardParent(cardId, parentId) {
  try {
    await iframe.api.put(`/cards/${cardId}`, {
      parent_id: parentId
    });
    return true;
  } catch (error) {
    console.error('Ошибка обновления карточки:', error);
    return false;
  }
}

// Получение space_id разными способами
async function getCurrentSpaceId(cardId) {
  try {
    setStatus('3/6: Определяем пространство...');
    
    // Способ 1: Через контекст карточки
    try {
      const cardContext = await iframe.getCardContext();
      console.log('Card context:', cardContext);
      if (cardContext && cardContext.space_id) {
        return cardContext.space_id;
      }
    } catch (e) {
      console.log('getCardContext не работает:', e);
    }
    
    // Способ 2: Через API карточки
    try {
      const cardData = await iframe.api.get(`/cards/${cardId}`);
      console.log('Card data from API:', cardData);
      if (cardData && cardData.space && cardData.space.id) {
        return cardData.space.id;
      }
      if (cardData && cardData.space_id) {
        return cardData.space_id;
      }
    } catch (e) {
      console.log('API запрос карточки не работает:', e);
    }
    
    return null;
    
  } catch (error) {
    console.log('Ошибка получения space_id:', error);
    return null;
  }
}

// Показать результаты поиска во всех пространствах
async function showAllPossibleResults(innValue) {
  setStatus('4/6: Поиск во всех настроенных пространствах...');
  
  const allFoundCards = [];
  
  // Ищем во всех поисковых пространствах
  for (const [inputSpaceId, searchSpaceId] of Object.entries(spaceMap)) {
    try {
      setStatus(`Поиск в пространстве ${searchSpaceId}...`);
      const foundCards = await findCardsByInn(parseInt(searchSpaceId), innValue);
      
      if (foundCards && foundCards.length > 0) {
        // Добавляем информацию о пространстве к каждой карточке
        foundCards.forEach(card => {
          card._sourceSpace = searchSpaceId;
        });
        allFoundCards.push(...foundCards);
      }
    } catch (e) {
      console.log(`Ошибка поиска в пространстве ${searchSpaceId}:`, e);
    }
  }
  
  await showSearchResults(allFoundCards);
}

// Показать результаты поиска в конкретном пространстве
async function showTargetSpaceResults(currentSpaceId, innValue) {
  const searchSpaceId = spaceMap[currentSpaceId];
  
  setStatus(`5/6: Поиск в целевом пространстве ${searchSpaceId}...`);
  
  const foundCards = await findCardsByInn(searchSpaceId, innValue);
  await showSearchResults(foundCards);
}

// Показать результаты поиска
async function showSearchResults(foundCards) {
  setStatus('6/6: Обработка результатов...');
  
  // Скрываем статус и показываем основной UI
  if (statusInfo) statusInfo.style.display = 'none';
  if (mainUI) mainUI.style.display = 'block';
  if (loader) loader.style.display = 'block';
  iframe.fitSize(contentDiv);
  
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
      
      // Добавляем информацию о пространстве если есть
      const spaceInfo = card._sourceSpace ? ` (из пространства ${card._sourceSpace})` : '';
      
      label.innerHTML = `
        <input type="radio" name="parentCard" value="${card.id}" id="${radioId}"> 
        #${card.id} - ${card.title}${spaceInfo}
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

iframe.render(async () => {
  try {
    setStatus('1/6: Проверка доступных методов...');
    
    // Отладочная информация
    console.log('iframe object:', iframe);
    console.log('Available iframe methods:', Object.keys(iframe));
    console.log('iframe.api:', iframe.api);
    console.log('iframe.cards:', iframe.cards);
    console.log('iframe.boards:', iframe.boards);
    
    // 2. Чтение параметров из URL
    setStatus('2/6: Чтение параметров из URL...');
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('card_id');
    const boardId = urlParams.get('board_id');

    if (!cardId) {
      throw new Error('Не удалось получить card_id из URL');
    }
    
    currentCardId = cardId;
    setStatus(`Параметры получены. Card ID: ${cardId}, Board ID: ${boardId || 'нет'}`);
    
    // 3. Получение значения ИНН
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
    setStatus(`ИНН получен: ${innValue}`);
    
    // 4. Пробуем определить пространство
    const currentSpaceId = await getCurrentSpaceId(cardId);
    
    if (currentSpaceId && spaceMap[currentSpaceId]) {
      // Если удалось определить пространство и оно настроено
      setStatus(`4/6: Пространство определено: ${currentSpaceId}`);
      await showTargetSpaceResults(currentSpaceId, innValue);
    } else {
      // Если не получилось определить или пространство не настроено
      setStatus(`4/6: Пространство не определено (${currentSpaceId}). Поиск везде...`);
      await showAllPossibleResults(innValue);
    }

  } catch (error) {
    setStatus(`Критическая ошибка: ${error.message}`, true);
    console.error('Полная ошибка:', error);
  }
});

// Обработчик кнопки "Связать с договором"
setParentButton.addEventListener('click', async () => {
  const selectedRadio = document.querySelector('input[name="parentCard"]:checked');
  if (!selectedRadio) return;
  
  const parentCardId = parseInt(selectedRadio.value, 10);
  
  try {
    setParentButton.disabled = true;
    setParentButton.textContent = 'Связывание...';
    
    const success = await updateCardParent(currentCardId, parentCardId);
    
    if (success) {
      iframe.showSnackbar('Связь с договором установлена!', 'success');
      iframe.closePopup();
    } else {
      throw new Error('Не удалось обновить карточку');
    }
    
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
