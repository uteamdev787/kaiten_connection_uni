const iframe = Addon.iframe();

// Конфигурация
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;

// DOM элементы
const innDisplay = document.getElementById('innDisplay');
const searchSpaceIdSpan = document.getElementById('searchSpaceId');
const searchInnSpan = document.getElementById('searchInn');
const targetSpace = document.getElementById('targetSpace');
const spaceInfo = document.getElementById('spaceInfo');
const parentCardIdInput = document.getElementById('parentCardId');
const linkButton = document.getElementById('linkButton');
const cancelButton = document.getElementById('cancelButton');
const linksList = document.getElementById('linksList');
const searchContent = document.getElementById('searchContent');

let currentCard = null;
let currentSpaceId = null;
let searchSpaceId = null;
let innValue = null;

// Функция создания быстрых ссылок
function createQuickLinks() {
  if (!searchSpaceId || !innValue) return;
  
  // Создаем ссылки для быстрого перехода к поиску
  const links = [
    {
      text: `🔍 Найти карточки в пространстве ${searchSpaceId}`,
      url: `https://pokusaev.kaiten.ru/space/${searchSpaceId}/board`,
      description: `Ищите карточки с ИНН: ${innValue}`
    },
    {
      text: `📋 Все карточки пространства ${searchSpaceId}`, 
      url: `https://pokusaev.kaiten.ru/space/${searchSpaceId}/cards`,
      description: 'Просмотр всех карточек в пространстве'
    }
  ];
  
  linksList.innerHTML = links.map(link => `
    <a href="${link.url}" target="_blank" class="card-link" style="margin-bottom: 8px;">
      <div class="card-title">${link.text}</div>
      <div class="card-meta">${link.description}</div>
    </a>
  `).join('');
}

// Функция связывания карточек
async function linkCards() {
  const parentId = parseInt(parentCardIdInput.value.trim(), 10);
  
  if (!parentId || parentId <= 0) {
    iframe.showSnackbar('Введите корректный ID карточки', 'error');
    return;
  }
  
  if (!currentCard) {
    iframe.showSnackbar('Ошибка: данные текущей карточки не получены', 'error');
    return;
  }
  
  try {
    linkButton.disabled = true;
    linkButton.textContent = 'Связывание...';
    
    // Попытка связать карточки через доступный API
    await iframe.requestWithContext({
      method: 'PUT',
      url: `/cards/${currentCard.id}`,
      data: {
        parent_id: parentId
      }
    });
    
    iframe.showSnackbar(`Карточка #${parentId} установлена как родительская!`, 'success');
    iframe.closePopup();
    
  } catch (error) {
    console.error('Ошибка связывания:', error);
    
    // Если API не работает, показываем инструкцию
    const instructions = `
ИНСТРУКЦИЯ ДЛЯ РУЧНОГО СВЯЗЫВАНИЯ:

1. Откройте карточку #${currentCard.id} в отдельной вкладке
2. Найдите поле "Родительская карточка" или "Parent Card"
3. Введите ID: ${parentId}
4. Сохраните изменения

Либо используйте быстрое связывание:
- Перейдите по ссылке: https://pokusaev.kaiten.ru/card/${currentCard.id}/edit
- Найдите поле связей
- Добавьте карточку #${parentId} как родительскую
    `.trim();
    
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(instructions);
      iframe.showSnackbar('Инструкция скопирована в буфер обмена. Выполните связывание вручную.', 'info');
    } else {
      alert(instructions);
    }
    
    linkButton.disabled = false;
    linkButton.textContent = 'Связать карточки';
  }
}

// Валидация ввода
function validateInput() {
  const value = parentCardIdInput.value.trim();
  const isValid = value && !isNaN(value) && parseInt(value) > 0;
  linkButton.disabled = !isValid;
}

// Обработчики событий
parentCardIdInput.addEventListener('input', validateInput);
parentCardIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !linkButton.disabled) {
    linkCards();
  }
});

linkButton.addEventListener('click', linkCards);
cancelButton.addEventListener('click', () => iframe.closePopup());

// Инициализация при рендере
iframe.render(async () => {
  try {
    // Получаем контекст и данные текущей карточки
    const context = await iframe.getContext();
    currentCard = await iframe.getCard();
    
    if (!currentCard) {
      throw new Error('Не удалось получить данные карточки');
    }
    
    // Получаем ИНН из properties
    const innKey = `id_${innFieldId}`;
    innValue = currentCard.properties && currentCard.properties[innKey];
    
    if (!innValue) {
      innDisplay.textContent = 'Поле ИНН не заполнено';
      innDisplay.style.color = 'var(--addon-error-color)';
      return;
    }
    
    innDisplay.textContent = innValue;
    
    // Определяем пространство
    currentSpaceId = currentCard.space?.id || currentCard.space_id;
    
    // Пытаемся определить через board_id если space_id нет
    if (!currentSpaceId && currentCard.board_id) {
      // Статический маппинг board_id -> space_id (нужно настроить под ваши данные)
      const boardToSpaceMap = {
        1183281: 517319 // board_id из логов -> предполагаемое пространство
      };
      currentSpaceId = boardToSpaceMap[currentCard.board_id];
    }
    
    if (currentSpaceId) {
      searchSpaceId = spaceMap[currentSpaceId];
      
      if (searchSpaceId) {
        // Показываем информацию о поиске
        spaceInfo.style.display = 'block';
        targetSpace.textContent = searchSpaceId;
        searchSpaceIdSpan.textContent = searchSpaceId;
        searchInnSpan.textContent = innValue;
        
        // Создаем быстрые ссылки
        createQuickLinks();
      } else {
        searchSpaceIdSpan.textContent = 'не настроено';
        searchInnSpan.textContent = innValue;
      }
    } else {
      // Если пространство не определено, показываем все варианты
      const allSpaces = Object.values(spaceMap).join(', ');
      searchSpaceIdSpan.textContent = `одном из: ${allSpaces}`;
      searchInnSpan.textContent = innValue;
      
      // Создаем ссылки на все пространства
      const allLinks = Object.values(spaceMap).map(spaceId => ({
        text: `🔍 Поиск в пространстве ${spaceId}`,
        url: `https://pokusaev.kaiten.ru/space/${spaceId}/cards`,
        description: `Ищите карточки с ИНН: ${innValue}`
      }));
      
      linksList.innerHTML = allLinks.map(link => `
        <a href="${link.url}" target="_blank" class="card-link">
          <div class="card-title">${link.text}</div>
          <div class="card-meta">${link.description}</div>
        </a>
      `).join('');
    }
    
    console.log('Данные для поиска:');
    console.log('Current space ID:', currentSpaceId);
    console.log('Search space ID:', searchSpaceId);
    console.log('INN value:', innValue);
    console.log('Board ID:', currentCard.board_id);
    
    iframe.fitSize(searchContent);
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    innDisplay.textContent = `Ошибка: ${error.message}`;
    innDisplay.style.color = 'var(--addon-error-color)';
  }
});
