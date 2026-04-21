// Helper untuk generate tanggal kerja (Senin-Sabtu) dalam bulan dan tahun tertentu, sampai hari ini
function getWorkdaysUntilToday(month, year) {
    const today = new Date();
    const lastDay = (today.getMonth() + 1 === month && today.getFullYear() === year)
        ? today.getDate()
        : new Date(year, month, 0).getDate();
    const dates = [];
    for (let d = 1; d <= lastDay; d++) {
        const dateObj = new Date(year, month - 1, d);
        const day = dateObj.getDay();
        if (day !== 0) { // 0 = Minggu
            dates.push(dateObj.toISOString().slice(0, 10));
        }
    }
    return dates;
}

module.exports = { getWorkdaysUntilToday };