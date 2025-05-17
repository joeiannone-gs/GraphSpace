import loginPNG from '@/public/loginScreen.png'




export const PreLogin = ({ message, loginClick }: { message: string, loginClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '97vh', backgroundImage: `url(${loginPNG.src})`, backgroundSize: 'cover', backgroundPosition: 'bottom' }}>
        <div style={{ position: 'relative', top: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#fff', fontSize: '1em' }}>Login to access the alpha release  </p>
          <p  style={{ color: '#fff', fontSize: '0.75em' }}>{message}</p>
          {message &&<p style={{ color: '#fff', fontSize: '0.75em' }}> Please contact graphspace01@gmail.com if you would like to have access. Thank you!</p>}
          <br/>
          <button style={{ padding: '1em', fontSize: '1em', borderRadius: '5px', cursor: 'pointer' }} onClick={loginClick}>Login</button>
        </div>
      </div>
    )
}

