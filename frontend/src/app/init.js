import axios from "axios"

const initializeApp = () => {
    const configuredBaseUrl = process.env.REACT_APP_BASE_URL
    const fallbackBaseUrl = "http://localhost:5000"
    const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, "")

    axios.defaults.baseURL = baseUrl


    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        // dev code



    } else {
        // Prod build code



        // Removing console.log from prod
        console.log = () => {};


        // init analytics here
    }

}

export default initializeApp