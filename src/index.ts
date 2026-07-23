async function startApplication() {
  await import('./load-react-dom-root');

  // Keep the two valid dynamic imports in separate optimizer batches.
  await new Promise(resolve => setTimeout(resolve, 1000));

  await import('./bootstrap');
}

void startApplication();
