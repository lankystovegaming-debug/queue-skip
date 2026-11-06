/* Demo-only card checks. No payment service, network calls, or storage. */
window.demoCardErrors = (details, today) => {
  const errors = {};
  const number = details.number.replace(/[ -]/g, '');
  if (!details.holder.trim()) errors.holder = 'Enter the name on the test card.';
  if (!/^\d{16}$/.test(number)) {
    errors.number = 'Enter exactly 16 digits. Spaces and hyphens are allowed.';
  } else {
    const sum = [...number].reverse().reduce((total, digit, index) => {
      let value = Number(digit);
      if (index % 2) { value *= 2; if (value > 9) value -= 9; }
      return total + value;
    }, 0);
    if (/^0+$/.test(number) || sum % 10) errors.number = 'This test card number is not valid. Try 4242 4242 4242 4242.';
  }
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(details.expiry.trim());
  if (!expiry) errors.expiry = 'Enter a valid expiry date as MM/YY, for example 12/28.';
  else if (2000 + Number(expiry[2]) < today.year || (2000 + Number(expiry[2]) === today.year && Number(expiry[1]) < today.month)) {
    errors.expiry = 'This test card has expired. Use this month or a later date.';
  }
  if (!/^\d{3,4}$/.test(details.cvv)) errors.cvv = 'Enter a 3- or 4-digit security code.';
  return errors;
};
