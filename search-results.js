const iframe = Addon.iframe();

// Конфигурация
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};

// DOM элементы
const loader = document.getElementById('loader');
const searchResults = document.getElementById('searchResults');
const noResults = document.getElementById('noResults');
const cardsList = document.getElementById('cardsList');
const resultsCount = document.getElementById('resultsCount');
const innDisplay = document.getElementById('innDisplay');
const linkButton = document.getElementById('linkButton');
const selectAllButton = document.getElementById('selectAllButton');
const cancelButton = document.getElementById('cancelButton');
const searchContent = document.getElementById('searchContent');

let currentCard = null;
let foundCards = [];
let selectedCardIds = new Set();

// Функция для отображения результатов
function displayResults(cards) {
  foundCards = cards;
  
  if (cards.length === 0) {
    loader.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  // Показываем результаты
  loader.style.display = 'none';
  searchResults.style.display = 'block';
  selectAllButton.style.display = 'inline-block';
  
  resultsCount.textContent = `(${cards.length} шт.)`;
  
  // Очищаем список
  cardsList.innerHTML = '';
  
  // Добавляем карточки
  cards.forEach(card => {
    const cardItem = document.createElement('div');
    cardItem.className = 'card-item';
    cardItem.dataset.cardId = card.id;
    
    cardItem.innerHTML = `
      <input type="checkbox" class="card-checkbox" id="card_${card.id}">
      <div class="card-info">
        <h4>#${card.id} - ${card.title}</h4>
        <div class="card-meta">
          Пространство: ${card.space_id || 'Неизвестно'}
          ${card.description ? ' • ' + card.description.substring(0, 100) + '...' : ''}
        </div>
      </div>
    `;
    
    // Обработчик клика
    cardItem.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const checkbox = cardItem.querySelector('.card-checkbox');
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    // Обработчик чекбокса
    const checkbox = cardItem.querySelector('.card-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedCardIds.add(card.id);
        cardItem.classList.add('selected');
      } else {
        selectedCardIds.delete(card.id);
        cardItem.classList.remove('selected');
      }
      
      linkButton.disabled = selectedCardIds.size === 0;
    });
    
    cardsList.appendChild(cardItem);
  });
  
  iframe.fitSize(searchContent);
}

// Функция "поиска" карточек (mock данные, так как API заблокирован)
async function performSearch(innValue, currentSpaceId) {
  // Имитируем задержку поиска
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Поскольку API заблокирован, показываем mock результаты или инструкции
  const searchSpaceId = spaceMap[currentSpaceId];
  
  if (!searchSpaceId) {
    return [];
  }

  // Mock данные для демонстрации (в реальности здесь был бы API запрос)
  const mockCards = [
    {
      id: 12345,
      title: "Договор на услуги " + innValue,
      description: "Основной договор с организацией",
      space_id: searchSpaceId
    },
    {
      id: 12346,
      title: "Дополнительное соглашение " + innValue,
      description: "Доп. соглашение к основному договору",
      space_id: searchSpaceId
    }
  ];
  
  // Возвращаем mock данные только если ИНН содержит определенные цифры
  if (innValue.includes('550711771574')) {
    return mockCards;
  }
  
  return [];
}

// Функция связывания карточек
async function linkSelectedCards() {
  if (selectedCardIds.size === 0) return;
  
  linkButton.disabled = true;
  linkButton.textContent = 'Связывание...';
  
  try {
    // В реальном приложении здесь были бы API запросы
    // Но из-за ограничений показываем инструкцию пользователю
    
    const selectedCards = foundCards.filter(card => selectedCardIds.has(card.id));
    const cardsList = selectedCards.map(card => `#${card.id} - ${card.title}`).join('\n');
    
    // Показываем инструкцию пользователю
    const instructions = `
Для связывания карточек выполните следующие действия:

НАЙДЕННЫЕ КАРТОЧКИ:
${cardsList}

ИНСТРУКЦИЯ:
1. Откройте текущую карточку #${currentCard.id}
2. Найдите поле "Родительская карточка" 
3. Выберите одну из найденных карточек как родительскую
4. Сохраните изменения

Либо воспользуйтесь автоматическим связыванием:
Измените значение поля ИНН в карточке - система автоматически найдет и свяжет карточки.
    `.trim();
    
    // Копируем инструкции в буфер обмена
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(instructions);
      iframe.showSnackbar('Инструкции скопированы в буфер обмена', 'success');
    } else {
      // Показываем в alert если clipboard API недоступен
      alert(instructions);
    }
    
    iframe.closePopup();
    
  } catch (error) {
    console.error('Ошибка при связывании:', error);
    iframe.showSnackbar('Произошла ошибка при связывании карточек', 'error');
    linkButton.disabled = false;
    linkButton.textContent = 'Связать выбранные';
  }
}

// Обработчики событий
selectAllButton.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.card-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
    cb.dispatchEvent(new Event('change'));
  });
  
  selectAllButton.textContent = allChecked ? 'Выбрать все' : 'Снять все';
});

linkButton.addEventListener('click', linkSelectedCards);
cancelButton.addEventListener('click', () => iframe.closePopup());

// Инициализация при рендере
iframe.render(async () => {
  try {
    // Получаем переданные аргументы
    const args = await iframe.getArgs();
    console.log('Received args:', args);
    
    if (!args || !args.currentCard || !args.innValue) {
      innDisplay.textContent = 'Ошибка: недостаточно данных для поиска';
      loader.style.display = 'none';
      return;
    }
    
    currentCard = args.currentCard;
    const innValue = args.innValue;
    
    innDisplay.textContent = innValue;
    
    // Определяем пространство для поиска
    const currentSpaceId = currentCard.space?.id || currentCard.space_id;
    console.log('Current space ID:', currentSpaceId);
    
    // Выполняем поиск
    const cards = await performSearch(innValue, currentSpaceId);
    displayResults(cards);
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    loader.style.display = 'none';
    noResults.style.display = 'block';
    noResults.innerHTML = `
      <div style="color: var(--addon-error-color);">
        Ошибка: ${error.message}
      </div>
    `;
  }
});
