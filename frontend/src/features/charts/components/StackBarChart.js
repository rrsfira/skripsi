import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
  } from 'chart.js';
  import { Bar } from 'react-chartjs-2';
  import TitleCard from '../../../components/Cards/TitleCard';
  import { getChartColors } from '../../../utils/themePalette';
  
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
  
  function StackBarChart(){

      const chartColors = getChartColors();
  
      const options = {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                },
            },
        };
        
        const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
        
        const data = {
          labels,
          datasets: [
            {
              label: 'Store 1',
              data: labels.map(() => { return Math.random() * 1000 + 500 }),
              backgroundColor: chartColors[0],
            },
            {
              label: 'Store 2',
              data: labels.map(() => { return Math.random() * 1000 + 500 }),
              backgroundColor: chartColors[4],
            },
            {
                label: 'Store 3',
                data: labels.map(() => { return Math.random() * 1000 + 500 }),
                backgroundColor: chartColors[6],
              },
          ],
        };
  
      return(
        <TitleCard title={"Sales"} topMargin="mt-2">
              <Bar options={options} data={data} />
        </TitleCard>
  
      )
  }
  
  
  export default StackBarChart