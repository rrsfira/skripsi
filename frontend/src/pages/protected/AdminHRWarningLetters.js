import WarningLetterManager from '../../components/WarningLetters/WarningLetterManager'
import { adminApi } from '../../features/admin/api'

function AdminHRWarningLetters() {
    return (
        <WarningLetterManager
            pageTitle="Surat Peringatan"
            subtitle="Direktur hanya dapat membuat surat peringatan untuk pegawai HR yang memiliki level atasan atau manager."
            apiClient={adminApi}
        />
    )
}

export default AdminHRWarningLetters
