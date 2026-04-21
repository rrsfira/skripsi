import WarningLetterManager from '../../components/WarningLetters/WarningLetterManager'
import { hrApi } from '../../features/hr/api'

function HRWarningLetters() {
    return (
        <WarningLetterManager
            pageTitle="Surat Peringatan Pegawai"
            subtitle="HR dapat membuat surat peringatan SP1/SP2/SP3 untuk pegawai berdasarkan pelanggaran alpha."
            apiClient={hrApi}
        />
    )
}

export default HRWarningLetters
