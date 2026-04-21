import Holidays from "date-holidays";

const MiniCalendar = ({
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
}) => {
  const hd = new Holidays("ID");
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // Get holidays for the month
  const getHolidaysInMonth = () => {
    const holidays = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (hd.isHoliday(new Date(dateStr))) {
        holidays.push(day);
      }
    }
    return holidays;
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidays = getHolidaysInMonth();

  // Create array of days
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const isHoliday = (day) => holidays.includes(day);
  const isToday = (day) =>
    day === todayDay && month === todayMonth && year === todayYear;
  const isWeekend = (day) => {
    if (!day) return false;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  };

  const isWorkday = (day) => {
    if (!day) return false;
    return !(isWeekend(day) || isHoliday(day));
  };

  const weekDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2.5 text-xs mb-6">
        {weekDays.map((day) => (
          <div key={day} className="text-center font-bold p-2 text-base-content/80">
            {day}
          </div>
        ))}

        {days.map((day, index) => {
          const holiday = day && isHoliday(day);
          const weekend = day && isWeekend(day);
          const workday = day && isWorkday(day);
          const isCurrentDay = day && isToday(day);

          return (
            <div
              key={index}
              className={`h-10 w-full flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                !day
                  ? "bg-transparent"
                  : isCurrentDay
                    ? "bg-primary text-primary-content border-2 border-primary-focus shadow-md dark:text-white"
                    : holiday
                      ? "bg-error/30 text-error-content border border-error/55 dark:text-white"
                      : weekend
                        ? "bg-info/25 text-info-content border border-info/55 dark:text-white"
                        : workday
                          ? "bg-success/30 text-success-content border border-success/55 dark:text-white"
                          : "bg-base-200 text-base-content dark:text-white"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 text-xs border-t border-base-300 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-primary border-2 border-primary-focus"></div>
          <span className="text-base-content">Hari Ini</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-success/30 border border-success/55"></div>
          <span className="text-base-content">Hari Kerja</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-info/25 border border-info/55"></div>
          <span className="text-base-content">Weekend</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-error/30 border border-error/55"></div>
          <span className="text-base-content">Libur/Merah</span>
        </div>
      </div>
    </div>
  );
};

export default MiniCalendar;
