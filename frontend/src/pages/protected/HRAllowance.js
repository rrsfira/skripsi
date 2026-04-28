import { useDispatch } from "react-redux";
import { useEffect } from "react";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { useNavigate } from "react-router-dom";

function Allowance() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(setPageTitle({ title: "Manajemen Payroll" }));
  }, [dispatch]);

  return (
    <div className="grid md:grid-cols-2 grid-cols-1 gap-6">
      <TitleCard title="Pengaturan Payroll" topMargin="mt-0">
        <p className="text-sm opacity-70 mb-4">
          Atur komponen global payroll seperti pajak dan tunjangan makan yang
          berlaku untuk seluruh pegawai.
        </p>

        <button
          className="btn btn-accent w-full"
          onClick={() => navigate("/app/payroll-settings")}
        >
          Ubah Komponen Global
        </button>
      </TitleCard>

      {/* GAJI & TUNJANGAN JABATAN */}
      <TitleCard title="Gaji & Tunjangan Jabatan" topMargin="mt-0">
        <p className="text-sm opacity-70 mb-4">
          Kelola gaji pokok dan tunjangan jabatan berdasarkan posisi jabatan.
        </p>

        <button
          className="btn btn-primary w-full"
          onClick={() => navigate("/hr/position-allowance")}
        >
          Kelola Gaji & Tunjangan
        </button>
      </TitleCard>

      {/* TUNJANGAN LAINNYA */}
      <TitleCard title="Tunjangan Lainnya" topMargin="mt-0">
        <p className="text-sm opacity-70 mb-4">
          Input komponen tambahan seperti potongan lain atau bonus khusus.
        </p>

        <button
          className="btn btn-secondary w-full"
          onClick={() => navigate("/app/hr/other-allowance")}
        >
          Input Komponen Lain
        </button>
      </TitleCard>
    </div>
  );
}

export default Allowance;
