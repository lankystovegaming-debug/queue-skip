/* Demo-only card checks. No payment service, network calls, or storage. */
window.formatDemoCardNumber = value => /^[\d ]*$/.test(value) ? value.replace(/ /g,'').replace(/(.{4})(?=.)/g,'$1 ') : value;
window.demoCardErrors = (details, today) => {
  const errors = {};
  const number = details.number.replace(/ /g, '');
  if (!details.holder.trim()) errors.holder = 'Enter the name on the test card.';
  if (!/^\d{16}$/.test(number)) {
    errors.number = 'Enter a 16-digit card number using digits only. Spaces are added automatically.';
  }
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(details.expiry.trim());
  if (!expiry) errors.expiry = 'Enter a valid expiry date as MM/YY, for example 12/28.';
  else if (2000 + Number(expiry[2]) < today.year || (2000 + Number(expiry[2]) === today.year && Number(expiry[1]) < today.month)) {
    errors.expiry = 'This test card has expired. Use this month or a later date.';
  }
  if (!/^\d{3,4}$/.test(details.cvv)) errors.cvv = 'Enter a 3- or 4-digit security code.';
  return errors;
};
