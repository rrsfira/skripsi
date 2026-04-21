import {
    Chart as ChartJS,
    Filler,
    ArcElement,
    Title,
    Tooltip,
    Legend,
  } from 'chart.js';
  import { Pie } from 'react-chartjs-2';
  import TitleCard from '../../../components/Cards/TitleCard';
  import { getChartColors, toRgba } from '../../../utils/themePalette';
  
  ChartJS.register(ArcElement, Tooltip, Legend,
      Tooltip,
      Filler,
      Legend);
  
  function PieChart(){

      const chartColors = getChartColors().slice(0, 6);
  
      const options = {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
          },
        };
        
        const labels = ['India', 'Middle East', 'Europe', 'US', 'Latin America', 'Asia(non-india)'];
        
        const data = {
          labels,
          datasets: [
              {
                  label: '# of Orders',
                  data: [122, 219, 30, 51, 82, 13],
                  backgroundColor: chartColors.map((color) => toRgba(color, 0.8)),
                  borderColor: chartColors,
                  borderWidth: 1,
                }
          ],
        };
  
      return(
          <TitleCard title={"Orders by country"}>
                  <Pie options={options} data={data} />
          </TitleCard>
      )
  }
  
  
  export default PieChart