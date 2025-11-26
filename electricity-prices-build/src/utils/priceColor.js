export function getPriceClass(price, average, settings, isCurrent = false) {
  const result = { classes: '', reason: '' };
  const priceValue = parseFloat(price);

  // Always check fixed thresholds first
  if (priceValue <= parseFloat(settings.cheapThreshold)) {
    result.classes = isCurrent ? ['table-success', 'price-cheap-current'] : 'table-success';
    result.reason = `Price ${priceValue.toFixed(2)} is below cheap threshold ${settings.cheapThreshold}`;
    return result;
  }
  if (priceValue >= parseFloat(settings.expensiveThreshold)) {
    result.classes = isCurrent ? ['table-warning', 'price-expensive-current'] : 'table-warning';
    result.reason = `Price ${priceValue.toFixed(2)} is above expensive threshold ${settings.expensiveThreshold}`;
    return result;
  }

  // Only then check relative to average
  const cheapLimit = average * (1 - settings.cheapRange / 100);
  const expensiveLimit = average * (1 + settings.expensiveRange / 100);

  if (priceValue <= cheapLimit) {
    result.classes = isCurrent ? ['table-success', 'price-cheap-current'] : 'table-success';
    result.reason = `Price ${priceValue.toFixed(2)} is ${settings.cheapRange}% below average ${average.toFixed(2)}`;
    return result;
  }
  if (priceValue >= expensiveLimit) {
    result.classes = isCurrent ? ['table-warning', 'price-expensive-current'] : 'table-warning';
    result.reason = `Price ${priceValue.toFixed(2)} is ${settings.expensiveRange}% above average ${average.toFixed(2)}`;
    return result;
  }

  result.classes = isCurrent ? 'price-current' : '';
  result.reason = 'Normal price range';
  return result;
}
