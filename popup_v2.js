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
let currentContext = null;

function setStatus(message, isError = false) {
  console.log(message);
  if (statusInfo) {
    statusInfo.textContent = message;
    statusInfo.style.color = isError ? 'red' : '';
  }
}

// Поиск карточек через iframe.requestWithContext
async function findCardsByInn(spaceId, innValue) {
  try {
    setStatus(`Поиск в пространстве ${spaceId}...`);
    
    const response = await iframe.requestWithContext({
      method: 'GET',
      url: '/cards',
      params: {
        space_id: spaceId,
        'custom_fields[0][field_id]': innFieldId,
        'custom_fields[0][value]': innValue
      }
    });
    
    console.log(`Результат поиска в пространстве ${spaceId}:`, response);
    return response || [];
    
  } catch (error) {
    console.log(`Ошибка поиска в пространстве ${spaceId}:`, error);
    return [];
  }
}

// Обновление карточки через iframe.requestWithContext
async function updateCardParent(cardId, parentId) {
  try {
    await iframe.requestWithContext({
      method: 'PUT',
      url: `/cards/${cardId}`,
      data: {
        parent_id: parentId
      }
    });
    return true;
  } catch (error) {
    console.error('Ошибка обновления карточки:', error);
    return false;
  }
}

// Получение space_id через board
async function getSpaceIdFromBoard(boardId) {
  try {
    const boardData = await iframe.requestWithContext({
      method: 'GET',
      url: `/boards/${boardId}`
    });
    
    console.log('Board data:', boardData);
    
    if (boardData && boardData.space_id) {
      return boardData.space_id;
    }
    return null;
  } catch (error) {
    console.log('Ошибка получения данных доски:', error);
    return null;
  }
}

// Определение пространства через поиск
async function determineSpaceBySearch(innValue) {
  setStatus('Определяем пространство через поиск карточек...');
  
  // Проверяем все входные пространства
  for (const [inputSpaceId, searchSpaceId] of Object.entries(spaceMap)) {
    const foundCards = await findCardsByInn(parseInt(searchSpaceId), innValue);
    
    if (foundCards && foundCards.length > 0) {
      setStatus(`Найдены карточки в пространстве ${searchSpaceId}, значит текущее: ${inputSpaceId}`);
      return {
        currentSpaceId: parseInt(inputSpaceId),
        searchSpaceId: parseInt(searchSpaceId),
        foundCards: foundCards
      };
    }
  }
  
  return null;
}

// Показать результаты поиска во всех пространствах
async function showAllPossibleResults(innValue) {
  setStatus('Поиск во всех настроенных пространствах...');
  
  const allFoundCards = [];
  
  // Ищем во всех поисковых пространствах
  for (const [inputSpaceId, searchSpaceId] of Object.entries(spaceMap)) {
    const foundCards = await findCardsByInn(parseInt(searchSpaceId), innValue);
    
    if (foundCards && foundCards.length > 0) {
      // Добавляем информацию о пространстве к каждой карточке
      foundCards.forEach(card => {
        card._sourceSpace = searchSpaceId;
        card._inputSpace = inputSpaceId;
      });
      allFoundCards.push(...foundCards);
    }
  }
  
  await showSearchResults(allFoundCards);
}

// Показать результаты поиска
async function showSearchResults(foundCards) {
  setStatus('Обработка результатов...');
  
  // Скрываем статус и показываем основной UI
  if (statusInfo) statusInfo.style.display = 'none';
  if (mainUI) mainUI.style.display = 'block';
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
    setStatus('1/5: Получение контекста аддона...');
    
    // Получаем контекст iframe
    currentContext = await iframe.getContext();
    console.log('Полный контекст:', currentContext);
    
    if (!currentContext || !currentContext.card_id) {
      throw new Error('Не удалось получить контекст карточки');
    }
    
    currentCardId = currentContext.card_id;
    const boardId = currentContext.board_id;
    
    setStatus(`2/5: Контекст получен. Card ID: ${currentCardId}, Board ID: ${boardId}`);
    
    // 3. Получение значения ИНН
    setStatus('3/5: Получение значения ИНН...');
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
    
    // 4. Попытка определить пространство через board
    setStatus('4/5: Определение пространства через доску...');
    const currentSpaceId = await getSpaceIdFromBoard(boardId);
    
    // 5. Поиск карточек
    if (currentSpaceId && spaceMap[currentSpaceId]) {
      // Ищем в конкретном пространстве
      const searchSpaceId = spaceMap[currentSpaceId];
      setStatus(`5/5: Поиск в целевом пространстве ${searchSpaceId}...`);
      
      const foundCards = await findCardsByInn(searchSpaceId, innValue);
      await showSearchResults(foundCards);
      
    } else {
      // Определяем пространство через поиск
      setStatus('5/5: Определение пространства через поиск...');
      
      const searchResult = await determineSpaceBySearch(innValue);
      
      if (searchResult) {
        setStatus(`Пространство определено через поиск: ${searchResult.currentSpaceId}`);
        await showSearchResults(searchResult.foundCards);
      } else {
        setStatus('Пространство не определено, показываем все результаты...');
        await showAllPossibleResults(innValue);
      }
    }

  } catch (error) {
    setStatus(`Критическая ошибка: ${error.message}`, true);
    console.error('Полная ошибка:', error);
    
    // Показываем UI даже при ошибке
    if (statusInfo) statusInfo.style.display = 'none';
    if (mainUI) mainUI.style.display = 'block';
    if (noResultsBlock) noResultsBlock.style.display = 'block';
    iframe.fitSize(contentDiv);
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
