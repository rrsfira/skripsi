import {
    Chart as ChartJS,
    Filler,
    ArcElement,
    Tooltip,
    Legend,
  } from 'chart.js';
  import { Scatter } from 'react-chartjs-2';
  import TitleCard from '../../../components/Cards/TitleCard';
  import { getChartColors } from '../../../utils/themePalette';
  
  ChartJS.register(ArcElement, Tooltip, Legend,
      Tooltip,
      Filler,
      Legend);
  
  function ScatterChart(){

      const chartColors = getChartColors();
  
      const options = {
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
        };
        
        const data = {
          datasets: [
            {
              label: 'Orders > 1k',
              data: Array.from({ length: 100 }, () => ({
                x: Math.random() * 11,
                y: Math.random() * 31,
              })),
              backgroundColor: chartColors[0],
            },
            {
                label: 'Orders > 2K',
                data: Array.from({ length: 100 }, () => ({
                  x: Math.random() * 12,
                  y: Math.random() * 12,
                })),
                backgroundColor: chartColors[3],
              },
          ],
        };
  
      return(
          <TitleCard title={"No of Orders by month (in k)"}>
                  <Scatter options={options} data={data} />
          </TitleCard>
      )
  }
  
  
  export default ScatterChart