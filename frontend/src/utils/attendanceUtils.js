import Holidays from 'date-holidays'

const hd = new Holidays('ID')

export const isWorkday = (date) => {
    const dayOfWeek = date.getDay()
    // Senin-Jumat = workday (1-5), Sabtu = workday (6), Minggu = weekend (0)
    const isSaturdayToFriday = dayOfWeek !== 0 // Monday-Saturday, not Sunday
    const isNotHoliday = !hd.isHoliday(date)
    return isSaturdayToFriday && isNotHoliday
}

export const calculateWorkdaysInMonth = (month, year) => {
    const daysInMonth = new Date(year, month, 0).getDate()
    let workdayCount = 0
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day)
        if (isWorkday(date)) {
            workdayCount++
        }
    }
    
    return workdayCount
}

export const getHolidaysInMonth = (month, year) => {
    const holidays = []
    const daysInMonth = new Date(year, month, 0).getDate()
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day)
        if (hd.isHoliday(date)) {
            holidays.push({
                day,
                name: hd.getHolidays(year).find(h => 
                    h.date === `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                )?.name || 'Hari Libur'
            })
        }
    }
    
    return holidays
}

export const calculateAccuratePercentage = (presentDays, month, year) => {
    const totalWorkdays = calculateWorkdaysInMonth(month, year)
    if (totalWorkdays === 0) return 0
    return Math.round((presentDays / totalWorkdays) * 100)
}
