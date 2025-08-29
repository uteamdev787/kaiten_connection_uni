// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

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

let iframe;
let currentCardId = null;

function setStatus(message, isError = false) {
  console.log(message);
  if (statusInfo) {
    statusInfo.textContent = message;
    statusInfo.style.color = isError ? 'red' : '';
  }
}

// Инициализация аддона с проверкой
async function initializeAddon() {
  try {
    setStatus('Инициализация Kaiten SDK...');
    
    // Ждем полной инициализации Addon
    await new Promise((resolve) => {
      if (window.Addon) {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });

    if (!window.Addon) {
      throw new Error('Kaiten Addon SDK не загружен');
    }

    iframe = Addon.iframe();
    
    if (!iframe) {
      throw new Error('Не удалось создать iframe объект');
    }

    setStatus('SDK инициализирован. Запуск основной логики...');
    return true;
    
  } catch (error) {
    setStatus(`Ошибка инициализации SDK: ${error.message}`, true);
    return false;
  }
}

// Получение данных о пространстве через карточку
async function getCurrentSpaceId(cardId) {
  try {
    setStatus('3/6: Получение данных карточки для определения пространства...');
    
    // Пробуем разные способы получить space_id
    
    // Способ 1: Через getCardProperties
    try {
      const cardContext = await iframe.getCardContext();
      if (cardContext && cardContext.space_id) {
        return cardContext.space_id;
      }
    } catch (e) {
      console.log('getCardContext не сработал:', e);
    }
    
    // Способ 2: Через прямой API запрос
    try {
      const cardData = await iframe.api.get(`/cards/${cardId}`);
      if (cardData && cardData.space && cardData.space.id) {
        return cardData.space.id;
      }
    } catch (e) {
      console.log('Прямой API запрос карточки не сработал:', e);
    }
    
    throw new Error('Не удалось определить ID пространства');
    
  } catch (error) {
    throw new Error(`Ошибка получения space_id: ${error.message}`);
  }
}

// Основная функция
async function runMainLogic() {
  try {
    // 1. Инициализация SDK
    const initialized = await initializeAddon();
    if (!initialized) return;
    
    // 2. Чтение параметров из URL
    setStatus('2/6: Чтение параметров из URL...');
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('card_id');
    const boardId = urlParams.get('board_id');

    if (!cardId) {
      throw new Error('Не удалось получить card_id из URL');
    }
    
    currentCardId = cardId;
    setStatus(`Параметры: card_id=${cardId}, board_id=${boardId}`);
    
    // 3. Получение ID пространства
    const currentSpaceId = await getCurrentSpaceId(cardId);
    setStatus(`4/6: ID пространства: ${currentSpaceId}`);
    
    // 4. Получение значения ИНН
    setStatus('5/6: Получение значения поля ИНН...');
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
    setStatus(`ИНН найден: ${innValue}`);
    
    // 5. Проверка настройки пространства
    const searchSpaceId = spaceMap[currentSpaceId];
    if (!searchSpaceId) {
      throw new Error(`Пространство ${currentSpaceId} не настроено для поиска`);
    }
    
    setStatus(`6/6: Поиск в пространстве ${searchSpaceId}...`);
    
    // Скрываем статус и показываем основной UI
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

    if (loader) loader.style.display = 'none';

    // 7. Обработка результатов поиска
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

  } catch (error) {
    setStatus(`Критическая ошибка: ${error.message}`, true);
    console.error('Полная ошибка:', error);
  }
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

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  runMainLogic();
});

// Дополнительный запуск на случай, если DOMContentLoaded уже прошел
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runMainLogic);
} else {
  runMainLogic();
}
