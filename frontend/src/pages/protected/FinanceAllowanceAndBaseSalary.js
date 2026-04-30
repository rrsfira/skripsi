import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { useNavigate } from "react-router-dom";

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

function PositionSalary() {
  const dispatch = useDispatch();

  const [positions, setPositions] = useState([]);
  const navigate = useNavigate();
  const [editData, setEditData] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  // ✅ Dummy data (sesuai DB positions)
  const dummyPositions = [
    {
      id: 1,
      name: "Commissioner",
      level: "commissioner",
      base_salary: 18000000,
      position_allowance: 0,
      status: "active",
    },
    {
      id: 2,
      name: "Director",
      level: "director",
      base_salary: 15000000,
      position_allowance: 0,
      status: "active",
    },
    {
      id: 3,
      name: "Operations Manager",
      level: "manager",
      base_salary: 10000000,
      position_allowance: 2000000,
      status: "active",
    },
  ];

  useEffect(() => {
    dispatch(setPageTitle({ title: "Position Salary Settings" }));
    setPositions(dummyPositions);
  }, []);

  const handleChange = (id, field, value) => {
    setEditData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = (id) => {
    setLoadingId(id);

    setTimeout(() => {
      setPositions((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...editData[id] } : item,
        ),
      );

      setEditData((prev) => ({ ...prev, [id]: {} }));
      setLoadingId(null);
    }, 500);
  };

  return (
    <TitleCard
      title="Input Gaji Pokok & Tunjangan Jabatan"
        topMargin="mt-0"
        TopSideButtons={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(-1)}
          >
            Kembali
          </button>
        }
    >
      <div className="overflow-x-auto w-full">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Position</th>
              <th>Level</th>
              <th>Base Salary</th>
              <th>Allowance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {positions.map((pos) => {
              const current = editData[pos.id] || {};

              return (
                <tr key={pos.id}>
                  <td className="font-semibold">{pos.name}</td>

                  <td>{pos.level}</td>

                  {/* Base Salary */}
                  <td>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={current.base_salary ?? pos.base_salary}
                      onChange={(e) =>
                        handleChange(pos.id, "base_salary", e.target.value)
                      }
                    />
                    <div className="text-xs opacity-60">
                      {formatCurrency(current.base_salary ?? pos.base_salary)}
                    </div>
                  </td>

                  {/* Allowance */}
                  <td>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={
                        current.position_allowance ??
                        pos.position_allowance ??
                        ""
                      }
                      onChange={(e) =>
                        handleChange(
                          pos.id,
                          "position_allowance",
                          e.target.value,
                        )
                      }
                    />
                    <div className="text-xs opacity-60">
                      {formatCurrency(
                        current.position_allowance ?? pos.position_allowance,
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <span className="badge badge-success">{pos.status}</span>
                  </td>

                  {/* Action */}
                  <td>
                    <button
                      className={`btn btn-sm ${
                        loadingId === pos.id ? "btn-disabled" : "btn-primary"
                      }`}
                      onClick={() => handleSave(pos.id)}
                    >
                      {loadingId === pos.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TitleCard>
  );
}

export default PositionSalary;
