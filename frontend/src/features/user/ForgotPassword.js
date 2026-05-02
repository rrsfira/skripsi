import {useState, useRef} from 'react'
import {Link} from 'react-router-dom'
import LandingIntro from './LandingIntro'
import ErrorText from  '../../components/Typography/ErrorText'
import InputText from '../../components/Input/InputText'
import CheckCircleIcon  from '@heroicons/react/24/solid/CheckCircleIcon'

function ForgotPassword(){

    const INITIAL_USER_OBJ = {
        emailId : ""
    }

    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [linkSent, setLinkSent] = useState(false)
    const [userObj, setUserObj] = useState(INITIAL_USER_OBJ)

    const submitForm = async (e) =>{
        e.preventDefault()
        setErrorMessage("")

        if(userObj.emailId.trim() === "")return setErrorMessage("Email adalah wajib diisi")
        else{
            try {
                setLoading(true)
                const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: userObj.emailId.trim()
                    })
                })

                const data = await response.json()

                if (!response.ok) {
                    return setErrorMessage(data.message || "Gagal mengirim link reset password")
                }

                setLinkSent(true)
                setUserObj(INITIAL_USER_OBJ)
            } catch (error) {
                setErrorMessage(error.message || "Terjadi kesalahan")
            } finally {
                setLoading(false)
            }
        }
    }

    const updateFormValue = ({updateType, value}) => {
        setErrorMessage("")
        setUserObj({...userObj, [updateType] : value})
    }

    return(
        <div className="min-h-screen bg-base-200 flex items-center">
            <div className="card mx-auto w-full max-w-5xl  shadow-xl">
                <div className="grid  md:grid-cols-2 grid-cols-1  bg-base-100 rounded-xl">
                <div className=''>
                        <LandingIntro />
                </div>
                <div className='py-24 px-10'>
                    <h2 className='text-2xl font-semibold mb-2 text-center'>Lupa Password</h2>

                    {
                        linkSent && 
                        <>
                            <div className='text-center mt-8'><CheckCircleIcon className='inline-block w-32 text-success'/></div>
                            <p className='my-4 text-xl font-bold text-center'>Link Terkirim</p>
                            <p className='mt-4 mb-8 font-semibold text-center'>Periksa email Anda untuk mereset password</p>
                            <div className='text-center mt-4'><Link to="/login"><button className="btn btn-block btn-primary ">Login</button></Link></div>

                        </>
                    }

                    {
                        !linkSent && 
                        <>
                            <p className='my-8 font-semibold text-center'>Kami akan mengirimkan link reset password ke email Anda</p>
                            <form onSubmit={(e) => submitForm(e)}>

                                <div className="mb-4">

                                    <InputText type="emailId" defaultValue={userObj.emailId} updateType="emailId" containerStyle="mt-4" labelTitle="Email" updateFormValue={updateFormValue}/>


                                </div>

                                <ErrorText styleClass="mt-12">{errorMessage}</ErrorText>
                                <button type="submit" className={"btn mt-2 w-full btn-primary" + (loading ? " loading" : "")}>Kirim Link Reset</button>

                                <div className='text-center mt-4'>Belum punya akun? <Link to="/register"><button className="  inline-block  hover:text-primary hover:underline hover:cursor-pointer transition duration-200">Daftar</button></Link></div>
                            </form>
                        </>
                    }
                    
                </div>
            </div>
            </div>
        </div>
    )
}

export default ForgotPassword