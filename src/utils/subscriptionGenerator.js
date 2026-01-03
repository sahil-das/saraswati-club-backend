/**
 * Generates the installment slots based on frequency and count.
 * Used when a user joins a year or when a year is created.
 */
exports.generateInstallments = (frequency, count, defaultAmount) => {
  const installments = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 1; i <= count; i++) {
    let label = "";

    if (frequency === "monthly") {
      // Logic: 1=Jan, 12=Dec, 13=Month 13
      label = i <= 12 ? monthNames[i - 1] : `Month ${i}`;
    } else {
      label = `Week ${i}`;
    }

    installments.push({
      index: i,
      label: label,
      amountExpected: defaultAmount || 0,
      isPaid: false,
      paidAt: null,
      collectedBy: null
    });
  }

  return installments;
};