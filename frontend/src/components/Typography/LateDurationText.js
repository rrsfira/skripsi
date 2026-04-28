const formatLateDuration = (lateMinutes) => {
    const minutes = Number(lateMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return '00 jam 00 menit 00 detik'
    }

    const totalSeconds = Math.round(minutes * 60)
    const hours = Math.floor(totalSeconds / 3600)
    const remainingSeconds = totalSeconds % 3600
    const mins = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60

    const [hh, mm, ss] = [hours, mins, secs].map((value) => String(value).padStart(2, '0'))
    return `${hh} jam ${mm} menit ${ss} detik`
}

function LateDurationText({ minutes, className = '' }) {
    return <span className={className}>{formatLateDuration(minutes)}</span>
}

export { formatLateDuration }
export default LateDurationText
