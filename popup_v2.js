// --- ДИАГНОСТИЧЕСКАЯ ВЕРСИЯ ---
const iframe = Addon.iframe();

// Получаем элементы DOM
const statusInfo = document.getElementById('status-info');
const mainUI = document.getElementById('main-ui');

function setStatus(message, isError = false) {
  console.log(message);
  if (statusInfo) {
      statusInfo.innerHTML += message + '<br>';
      if (isError) statusInfo.style.color = 'red';
  }
}

iframe.render(async () => {
  try {
    if(mainUI) mainUI.style.display = 'none';
    setStatus('--- НАЧАЛО ДИАГНОСТИКИ ---');

    // 1. Выводим в консоль весь объект iframe, чтобы увидеть все его методы
    setStatus('1. Вывод объекта "iframe" в консоль...');
    console.log('DIAGNOSTIC: The "iframe" object is:', iframe);

    // 2. Проверяем наличие и результат iframe.getCard()
    setStatus('2. Проверка iframe.getCard()...');
    if (typeof iframe.getCard === 'function') {
        const card = await iframe.getCard();
        console.log('DIAGNOSTIC: iframe.getCard() result:', card);
        setStatus('   => OK. Функция существует.');
    } else {
        setStatus('   => ОШИБКА: iframe.getCard НЕ является функцией.', true);
    }
    
    // 3. Проверяем наличие и результат iframe.getCardProperties()
    setStatus('3. Проверка iframe.getCardProperties()...');
     if (typeof iframe.getCardProperties === 'function') {
        const props = await iframe.getCardProperties('customProperties');
        console.log('DIAGNOSTIC: iframe.getCardProperties() result:', props);
        setStatus('   => OK. Функция существует.');
    } else {
        setStatus('   => ОШИБКА: iframe.getCardProperties НЕ является функцией.', true);
    }

    // 4. Проверяем наличие iframe.getArgs() - главная проверка
    setStatus('4. Проверка iframe.getArgs()...');
    if (typeof iframe.getArgs === 'function') {
        const args = await iframe.getArgs();
        console.log('DIAGNOSTIC: iframe.getArgs() result:', args);
        setStatus('   => OK. Функция существует.');
    } else {
        setStatus('   => ОШИБКА: iframe.getArgs НЕ является функцией.', true);
    }

    setStatus('<br>--- ДИАГНОСТИКА ЗАВЕРШЕНА ---');
    setStatus('Пожалуйста, скопируйте ВСЁ из консоли (Ctrl+A, Ctrl+C) и отправьте.');

  } catch (error) {
    setStatus(`КРИТИЧЕСКАЯ ОШИБКА В ПРОЦЕССЕ ДИАГНОСТИКИ: ${error.message}`, true);
    console.error('DIAGNOSTIC ERROR:', error);
  }
});
