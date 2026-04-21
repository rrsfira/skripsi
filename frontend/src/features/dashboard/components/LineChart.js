import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import TitleCard from '../../../components/Cards/TitleCard';
import { getChartColors, toRgba } from '../../../utils/themePalette';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

function LineChart(){

  const chartColors = getChartColors();

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  
  const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];

  const data = {
  labels,
  datasets: [
    {
      fill: true,
      label: 'MAU',
      data: labels.map(() => { return Math.random() * 100 + 500 }),
      borderColor: chartColors[4],
      backgroundColor: toRgba(chartColors[4], 0.5),
    },
  ],
};
  

    return(
      <TitleCard title={"Montly Active Users (in K)"}>
          <Line data={data} options={options}/>
      </TitleCard>
    )
}


export default LineChart